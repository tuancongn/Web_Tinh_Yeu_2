const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const path = require('path');

dotenv.config();

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY); 

const supabaseUrl = process.env.SUPABASE_URL; // Đổi thành biến môi trường
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Middleware
app.use(cors({
    origin: ['https://heartconnect.io.vn', 'https://www.heartconnect.io.vn', 'http://localhost:3000', 'http://localhost:5000'], 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../public')));

// JWT Verification Middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Token xác thực không tồn tại' });
    }
    
    try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        
        if (error || !user) {
            return res.status(403).json({ success: false, message: 'Token không hợp lệ' });
        }
        
        req.user = {
            id: user.id,
            email: user.email,
            metadata: user.user_metadata // Contains fullname, phone, etc.
        };
        next(); 
    } catch (error) {
        console.error('JWT verification error:', error);
        res.status(403).json({ success: false, message: 'Token xác thực thất bại' });
    }
};

app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        // `req.user` is now provided by our Supabase JWT middleware
        res.json({
            success: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                fullname: req.user.metadata.fullname || '',
                username: req.user.metadata.username || '',
                phone: req.user.metadata.phone || '',
                facebook: req.user.metadata.facebook || ''
            }
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// 5. Cập nhật thông tin user (Sử dụng Supabase)
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { fullname, phone, facebook, newPassword } = req.body;
        
        // Chỉ cập nhật metadata (fullname, phone, facebook)
        const updateData = {};
        if (fullname) updateData.fullname = fullname;
        if (phone) updateData.phone = phone;
        if (facebook) {
            if (!/^(https?:\/\/)?(www\.)?facebook\.com\/.+/.test(facebook)) {
                return res.status(400).json({
                    success: false,
                    message: 'Link Facebook không hợp lệ'
                });
            }
            updateData.facebook = facebook.startsWith('http') ? facebook : `https://${facebook}`;
        }
        
        // Cập nhật user metadata trong Supabase Auth
        const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            req.user.id,
            { user_metadata: updateData }
        );
        
        if (updateError) {
            console.error('Lỗi cập nhật Supabase:', updateError);
            return res.status(400).json({
                success: false,
                message: 'Lỗi cập nhật thông tin'
            });
        }
        
        // Nếu có yêu cầu đổi mật khẩu
        if (newPassword) {
            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Mật khẩu phải có ít nhất 6 ký tự'
                });
            }
            
            // Cập nhật mật khẩu
            const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
                req.user.id,
                { password: newPassword }
            );
            
            if (passwordError) {
                console.error('Lỗi đổi mật khẩu:', passwordError);
                return res.status(400).json({
                    success: false,
                    message: 'Lỗi khi đổi mật khẩu'
                });
            }
        }
        
        // Trả về thông tin user đã cập nhật
        const userMeta = updatedUser.user.user_metadata || {};
        res.json({
            success: true,
            message: 'Cập nhật thông tin thành công',
            user: {
                id: updatedUser.user.id,
                email: updatedUser.user.email,
                fullname: userMeta.fullname || '',
                username: userMeta.username || '',
                phone: userMeta.phone || '',
                facebook: userMeta.facebook || ''
            }
        });
        
    } catch (error) {
        console.error('Lỗi cập nhật user:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server, vui lòng thử lại sau'
        });
    }
});

// [SỬA] Hàm gửi Email Match - Xử lý đa cấu trúc dữ liệu user
async function sendMatchEmails(user1, user2, messageType) {
    const subject = "💘 TƯƠNG TƯ HỮU Ý - KẾT NỐI THÀNH CÔNG!";
    
    // Helper để lấy metadata an toàn từ cả 2 loại object
    const getMeta = (u) => u.metadata || u.user_metadata || {};
    
    const meta1 = getMeta(user1);
    const meta2 = getMeta(user2);
    
    // Nội dung email cho người 1
    const html1 = `
        <h1>Chúc mừng ${meta1.fullname}!</h1>
        <p>Bạn và <strong>${meta2.fullname}</strong> đều đã gửi tín hiệu <strong>"${messageType}"</strong> cho nhau.</p>
        <p>Hệ thống HeartConnect xác nhận hai bạn đã "Bắt được sóng" của nhau.</p>
        <p>Hãy liên hệ với nhau ngay qua Facebook: <a href="${meta2.facebook}">${meta2.facebook}</a></p>
    `;

    // Nội dung email cho người 2
    const html2 = `
        <h1>Chúc mừng ${meta2.fullname}!</h1>
        <p>Bạn và <strong>${meta1.fullname}</strong> đều đã gửi tín hiệu <strong>"${messageType}"</strong> cho nhau.</p>
        <p>Hệ thống HeartConnect xác nhận hai bạn đã "Bắt được sóng" của nhau.</p>
        <p>Hãy liên hệ với nhau ngay qua Facebook: <a href="${meta1.facebook}">${meta1.facebook}</a></p>
    `;

    // Gửi song song 2 email
    await Promise.all([
        resend.emails.send({ from: 'HeartConnect <info@heartconnect.io.vn>', to: [user1.email], subject, html: html1 }),
        resend.emails.send({ from: 'HeartConnect <info@heartconnect.io.vn>', to: [user2.email], subject, html: html2 })
    ]);
}

// 6. Gửi tin nhắn với tính năng matching
app.post('/api/messages/send', authenticateToken, async (req, res) => {
    try {
        const {
            receiverIdentifier,
            receiverMethod,
            messageType,
            title,
            content,
            isAnonymous,
            channels
        } = req.body;
        
        // Kiểm tra dữ liệu
        if (!receiverIdentifier || !receiverMethod || !messageType || !title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc'
            });
        }
        
        // 1. Tìm người nhận trong Supabase Auth (users)
        let receiverUser = null;
        const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError) {
            console.error('Lỗi lấy danh sách user:', listError);
        } else {
            const users = userList.users || [];
            
            if (receiverMethod === 'username') {
                // Tìm user theo username trong user_metadata
                receiverUser = users.find(u => 
                    u.user_metadata?.username === receiverIdentifier.toLowerCase()
                );
            } else if (receiverMethod === 'email') {
                receiverUser = users.find(u => u.email?.toLowerCase() === receiverIdentifier.toLowerCase());
            } else if (receiverMethod === 'phone') {
                // Tìm user theo phone trong user_metadata
                receiverUser = users.find(u => 
                    u.user_metadata?.phone === receiverIdentifier
                );
            } else if (receiverMethod === 'facebook') {
                // Tìm user theo facebook link trong user_metadata
                receiverUser = users.find(u => {
                    const facebook = u.user_metadata?.facebook || '';
                    return facebook.includes(receiverIdentifier);
                });
            }
        }
        
        // 2. Tạo tin nhắn trong bảng 'messages' của Supabase
        const messageData = {
            sender_id: req.user.id,
            receiver_id: receiverUser ? receiverUser.id : null,
            receiver_identifier: receiverIdentifier,
            receiver_method: receiverMethod,
            message_type: messageType,
            title: title,
            content: content,
            is_anonymous: isAnonymous || false,
            channels: channels || { inbox: true, email: false, sms: false }
        };
        
        // 3. Lưu tin nhắn vào Supabase
        const { data: newMessage, error: insertError } = await supabaseAdmin
            .from('messages')
            .insert(messageData)
            .select()
            .single();
        
        if (insertError) {
            console.error('Lỗi lưu tin nhắn vào Supabase:', insertError);
            return res.status(500).json({
                success: false,
                message: 'Lỗi khi lưu tin nhắn'
            });
        }
        
        // 4. KIỂM TRA MATCHING (Chỉ chạy nếu tìm thấy người nhận trong hệ thống)
        let isMatch = false;
        if (receiverUser) {
            // Kiểm tra xem Người nhận (B) đã từng gửi tin cùng loại cho Người gửi (A) chưa?
            const { data: reverseMsg, error: reverseError } = await supabaseAdmin
                .from('messages')
                .select('*')
                .eq('sender_id', receiverUser.id)
                .eq('receiver_id', req.user.id)
                .eq('message_type', messageType)
                .limit(1);
            
            if (!reverseError && reverseMsg && reverseMsg.length > 0) {
                // ==> MATCH FOUND! (Kết nối thành công)
                isMatch = true;
                console.log(`💘 MATCH FOUND: ${req.user.email} <-> ${receiverUser.email}`);
                
                // Gửi email thông báo cho cả 2
                try {
                    await sendMatchEmails(req.user, receiverUser, messageType);
                } catch (emailError) {
                    console.error("Lỗi gửi email match:", emailError);
                    // Không return lỗi để flow chính vẫn thành công
                }
            }
        }
        
        // 5. [SỬA ĐỔI QUAN TRỌNG] Gửi email thông báo tin nhắn mới
        // Logic cũ: Chỉ gửi nếu tìm bằng email -> SAI
        // Logic mới: Gửi nếu kênh Email được bật VÀ tìm thấy email của người nhận trong DB
        
        // Chỉ gửi nếu KHÔNG có match (vì match đã gửi email riêng)
        if (!isMatch && channels && channels.email) {
            // Xác định địa chỉ email để gửi
            let emailToSend = null;

            if (receiverUser && receiverUser.email) {
                // Trường hợp 1: Đã tìm thấy User trong DB (qua Username/Facebook/Phone/Email)
                emailToSend = receiverUser.email;
            } else if (receiverMethod === 'email') {
                // Trường hợp 2: Chưa tìm thấy User trong DB nhưng người gửi nhập vào là Email
                // (Gửi cho người chưa đăng ký)
                emailToSend = receiverIdentifier;
            }

            // Nếu có email hợp lệ thì mới gửi
if (emailToSend) {
                try {
                    // Xác định tên loại tin nhắn tiếng Việt để hiển thị đẹp hơn
                    const typeNames = {
                        'share': '💌 Lời tâm sự',
                        'confess': '💘 Lời bày tỏ',
                        'reconnect': '💞 Lời muốn quay lại'
                    };
                    const typeDisplay = typeNames[messageType] || '📩 Tin nhắn mới';

                    await resend.emails.send({
                        from: 'HeartConnect <info@heartconnect.io.vn>',
                        to: [emailToSend],
                        subject: `${typeDisplay} từ HeartConnect: "${title}"`,
                        html: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="utf-8">
                            <style>
                                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #ffeef8; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
                                .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(255, 77, 148, 0.15); }
                                .header { background: linear-gradient(135deg, #ff4d94 0%, #ff6b6b 100%); color: white; padding: 40px 20px; text-align: center; }
                                .header h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
                                .content { padding: 40px 30px; color: #333333; line-height: 1.6; }
                                .greeting { font-size: 18px; margin-bottom: 20px; color: #2d3748; }
                                .message-card { background-color: #fff5f9; border-left: 4px solid #ff4d94; padding: 25px; margin: 25px 0; border-radius: 8px; }
                                .message-title { font-weight: bold; font-size: 16px; color: #ff4d94; margin-bottom: 10px; display: block; }
                                .message-body { font-style: italic; color: #4a5568; font-size: 16px; }
                                .info-tag { display: inline-block; background-color: #edf2f7; padding: 5px 10px; border-radius: 15px; font-size: 12px; color: #718096; margin-top: 5px; font-weight: 600; }
                                .btn-container { text-align: center; margin-top: 35px; }
                                .btn { display: inline-block; background-color: #ff4d94; color: #ffffff !important; text-decoration: none; padding: 14px 30px; border-radius: 30px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(255, 77, 148, 0.3); transition: all 0.3s ease; }
                                .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 13px; color: #a0aec0; border-top: 1px solid #edf2f7; }
                                .footer a { color: #ff4d94; text-decoration: none; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1>HeartConnect 💌</h1>
                                    <div style="font-size: 14px; opacity: 0.9; margin-top: 5px;">Nơi trao gửi tình cảm chân thành</div>
                                </div>
                                <div class="content">
                                    <div class="greeting">Chào bạn,</div>
                                    <p>Có ai đó vừa gửi gắm những tâm tư tình cảm đến cho bạn thông qua HeartConnect.</p>
                                    
                                    <div class="message-card">
                                        <span class="message-title">✨ ${title}</span>
                                        <div class="message-body">"${content}"</div>
                                        <div style="margin-top: 15px;">
                                            <span class="info-tag">Loại: ${typeDisplay}</span>
                                            ${isAnonymous ? '<span class="info-tag">🎭 Người gửi ẩn danh</span>' : ''}
                                        </div>
                                    </div>

                                    <p>Để xem chi tiết người gửi, hồ sơ Facebook của họ hoặc trả lời tin nhắn này, hãy truy cập vào hệ thống:</p>

                                    <div class="btn-container">
                                        <a href="https://heartconnect.io.vn" class="btn">Xem tin nhắn ngay</a>
                                    </div>
                                </div>
                                <div class="footer">
                                    <p>Bạn nhận được email này vì ai đó đã nhập địa chỉ email của bạn trên HeartConnect.</p>
                                    <p>&copy; 2026 <strong>HeartConnect</strong>. All rights reserved.</p>
                                </div>
                            </div>
                        </body>
                        </html>
                        `
                    });
                    console.log(`Đã gửi email thông báo (Giao diện mới) đến: ${emailToSend}`);
                } catch (emailError) {
                    console.error("Lỗi gửi mail Resend:", emailError);
                }
            }
        }
        
        res.status(201).json({
            success: true,
            isMatch: isMatch,
            message: isMatch 
                ? 'Đã gửi và KẾT NỐI THÀNH CÔNG! Kiểm tra email ngay.' 
                : 'Tin nhắn đã được gửi thành công',
            data: {
                id: newMessage.id,
                receiver: receiverIdentifier,
                type: messageType,
                title,
                sentAt: newMessage.created_at,
                receiverFound: !!receiverUser,
                emailSent: !isMatch && channels && channels.email && (!!receiverUser?.email || receiverMethod === 'email')
            }
        });
        
    } catch (error) {
        console.error('Lỗi gửi tin nhắn:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server, vui lòng thử lại sau'
        });
    }
});

// Frontend sẽ gọi cái này trước. Nếu nhập Username -> API trả về Email -> Frontend dùng Email login
app.post('/api/auth/lookup-email', async (req, res) => {
    try {
        const { identifier } = req.body;
        console.log("Đang tra cứu:", identifier); 

        if (identifier.includes('@')) {
            return res.json({ success: true, email: identifier });
        }

        const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
        
        // Tìm user trong danh sách (So sánh không phân biệt hoa thường)
        const user = userList.users.find(u => {
            const meta = u.user_metadata || {};
            const username = meta.username ? meta.username.toLowerCase() : '';
            const phone = meta.phone || '';
            const search = identifier.toLowerCase();
            
            return username === search || phone === identifier;
        });

        if (user) {
            console.log("Tìm thấy user:", user.email);
            return res.json({ success: true, email: user.email });
        } else {
            console.log("Không tìm thấy user nào khớp.");
            return res.status(404).json({ success: false, message: 'Tài khoản không tồn tại' });
        }
    } catch (error) {
        console.error("Lỗi lookup:", error);
        res.status(500).json({ success: false, message: 'Lỗi server khi tra cứu' });
    }
});

// 7. Lấy tin nhắn đã nhận (Sử dụng Supabase - đã sửa)
app.get('/api/messages/inbox', authenticateToken, async (req, res) => {
    try {
        // 1. Lấy tin nhắn từ Supabase (không join)
        const { data: messages, error } = await supabaseAdmin
            .from('messages')
            .select('*')
            .eq('receiver_id', req.user.id)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Lỗi truy vấn Supabase:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy tin nhắn'
            });
        }
        
        // 2. Lấy thông tin người gửi cho mỗi tin nhắn
        const formattedMessages = [];
        for (const msg of (messages || [])) {
            let senderInfo = null;
            
            if (msg.sender_id && !msg.is_anonymous) {
                // Lấy thông tin người gửi từ Supabase Auth
                const { data: senderData, error: senderError } = await supabaseAdmin.auth.admin.getUserById(msg.sender_id);
                
                if (!senderError && senderData.user) {
                    const senderMeta = senderData.user.user_metadata || {};
                    senderInfo = {
                        id: senderData.user.id,
                        fullname: senderMeta.fullname || '',
                        username: senderMeta.username || '',
                        facebook: senderMeta.facebook || ''
                    };
                }
            } else if (msg.is_anonymous) {
                // Người gửi ẩn danh
                senderInfo = {
                    fullname: 'Ẩn danh',
                    username: 'anonymous'
                };
            }
            
            formattedMessages.push({
                id: msg.id,
                sender: senderInfo,
                title: msg.title,
                content: msg.content,
                messageType: msg.message_type,
                isAnonymous: msg.is_anonymous,
                createdAt: msg.created_at,
                read: msg.read || false
            });
        }
        
        res.json({
            success: true,
            count: formattedMessages.length,
            messages: formattedMessages
        });
        
    } catch (error) {
        console.error('Lỗi lấy tin nhắn:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server, vui lòng thử lại sau'
        });
    }
});

// 8. Lấy tin nhắn đã gửi (Sử dụng Supabase)
app.get('/api/messages/sent', authenticateToken, async (req, res) => {
    try {
        // Lấy tin nhắn đã gửi từ Supabase
        const { data: messages, error } = await supabaseAdmin
            .from('messages')
            .select('*')
            .eq('sender_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) {
            console.error('Lỗi truy vấn Supabase:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy tin nhắn đã gửi'
            });
        }
        
        res.json({
            success: true,
            count: messages ? messages.length : 0,
            messages: messages || []
        });
        
    } catch (error) {
        console.error('Lỗi lấy tin nhắn đã gửi:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server, vui lòng thử lại sau'
        });
    }
});

// [THÊM MỚI] 8.1 API Xóa tin nhắn
app.delete('/api/messages/:id', authenticateToken, async (req, res) => {
    try {
        const messageId = req.params.id;

        // Xóa tin nhắn, nhưng CHỈ xóa nếu người yêu cầu chính là người nhận (receiver_id)
        // để tránh việc user A xóa tin nhắn của user B
        const { error } = await supabaseAdmin
            .from('messages')
            .delete()
            .eq('id', messageId)
            .eq('receiver_id', req.user.id); // Quan trọng: Bảo mật quyền sở hữu

        if (error) throw error;

        res.json({ success: true, message: 'Đã xóa tin nhắn' });

    } catch (error) {
        console.error('Lỗi xóa tin nhắn:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi xóa tin nhắn' });
    }
});

// 9. API gửi feedback (Lưu vào Supabase)
app.post('/api/feedback', async (req, res) => {
    try {
        const { email, content } = req.body;
        
        if (!email || !content) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ thông tin'
            });
        }
        
        // Lưu feedback vào bảng 'feedbacks' trong Supabase
        const { data, error } = await supabaseAdmin
            .from('feedbacks')
            .insert([
                {
                    email: email,
                    content: content,
                    created_at: new Date()
                }
            ]);
        
        if (error) {
            console.error('Lỗi lưu feedback:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi khi lưu phản hồi'
            });
        }
        
        res.json({
            success: true,
            message: 'Cảm ơn phản hồi của bạn!'
        });
        
    } catch (error) {
        console.error('Lỗi gửi feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server, vui lòng thử lại sau'
        });
    }
});

// 10. Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'HeartConnect API đang hoạt động',
        timestamp: new Date(),
        version: '1.0.0'
    });
});

app.get(/.*/, (req, res) => {
    // Chỉ trả về index.html nếu không phải là request API
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    } else {
        res.status(404).json({ success: false, message: 'API Not Found' });
    }
});

// Khởi động server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    console.log(`👉 Hãy truy cập vào http://localhost:${PORT} để sử dụng Web`);
});

// Export cho Vercel (nếu deploy)
module.exports = app;