const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseUrl = process.env.SUPABASE_URL; // Đổi thành biến môi trường
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Middleware
app.use(helmet({
    contentSecurityPolicy: false // Tạm tắt CSP để không block inline script/CSS nếu có trên frontend
}));

app.use(cors({
    origin: ['https://heartconnect.io.vn', 'https://www.heartconnect.io.vn', 'http://localhost:3000', 'http://localhost:5000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

// Rate limiter chung cho API (100 reqs / 15 phút)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút' }
});
app.use('/api/', apiLimiter);

// Rate limiter khắt khe cho gửi tin và auth
const strictLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 giờ
    max: 30, // Tối đa 30 requests / 1 IP
    message: { success: false, message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau 1 giờ' }
});

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

async function sendMatchEmails(user1, user2, messageType) {
    // 1. Chuẩn bị dữ liệu hiển thị
    const getMeta = (u) => u.metadata || u.user_metadata || {};
    const meta1 = getMeta(user1);
    const meta2 = getMeta(user2);

    const typeNames = {
        'share': '💌 Lời Tâm Sự',
        'confess': '💘 Lời Bày Tỏ',
        'reconnect': '💞 Lời Muốn Quay Lại'
    };
    const typeDisplay = typeNames[messageType] || 'Tín hiệu tình yêu';

    const subject = `💘 KẾT NỐI THÀNH CÔNG: Bạn và ${meta2.fullname} đã "bắt sóng" nhau!`;

    // 2. Hàm tạo HTML Email chung (để tái sử dụng cho cả 2 người)
    // me: Người nhận email này, partner: Người kia
    const createMatchEmail = (me, partner) => {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #ffeef8; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(255, 77, 148, 0.2); }
                .header { background: linear-gradient(135deg, #ff4d94 0%, #ff7675 100%); padding: 40px 20px; text-align: center; color: white; }
                .header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; font-family: 'Inter', 'Segoe UI', sans-serif; }
                .header .subtitle { font-size: 16px; margin-top: 10px; opacity: 0.9; }
                .content { padding: 40px 30px; text-align: center; color: #4a5568; }
                .match-animation { font-size: 60px; margin: 20px 0; animation: heartbeat 1.5s infinite; }
                .message-box { background: #fff0f6; border: 2px dashed #ff4d94; border-radius: 12px; padding: 25px; margin: 30px 0; }
                .names { font-size: 20px; font-weight: bold; color: #d63384; margin-bottom: 10px; }
                .type-badge { background: #ff4d94; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px; font-weight: 600; display: inline-block; }
                .action-btn { display: inline-block; background: linear-gradient(to right, #ff4d94, #ff7675); color: white !important; text-decoration: none; padding: 15px 40px; border-radius: 50px; font-weight: bold; font-size: 18px; box-shadow: 0 5px 15px rgba(255, 77, 148, 0.4); margin-top: 20px; transition: transform 0.2s; }
                .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 13px; color: #a0aec0; border-top: 1px solid #edf2f7; }
                @keyframes heartbeat { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Chúc Mừng ${me.fullname}!</h1>
                    <div class="subtitle">Thần giao cách cảm đã xuất hiện 💖</div>
                </div>
                <div class="content">
                   
                    <p style="font-size: 18px; line-height: 1.6;">
                        Tuyệt vời! Hệ thống HeartConnect xác nhận:
                    </p>

                    <div class="message-box">
                        <div class="names">${me.fullname} &harr; ${partner.fullname}</div>
                        <p>Cả hai bạn đều đã gửi tín hiệu:</p>
                        <div class="type-badge">${typeDisplay}</div>
                        <p style="margin-top: 15px; font-style: italic;">"Trái tim đã lên tiếng, giờ là lúc hai bạn kết nối!"</p>
                    </div>

                    <p>Đừng để cơ hội vụt mất. Hãy liên hệ với người ấy ngay:</p>
                    
                    <a href="${partner.facebook}" class="action-btn">
                        Nhắn tin Facebook ngay 💬
                    </a>
                    
                    <p style="margin-top: 30px; font-size: 14px; color: #718096;">
                        Hoặc xem chi tiết link Facebook tại: ${partner.facebook}
                    </p>
                </div>
                <div class="footer">
                    <p>HeartConnect - Nơi tình yêu bắt đầu.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    };

    // 3. Gửi email song song
    await Promise.all([
        // Gửi cho người 1 (Báo tin về người 2)
        resend.emails.send({
            from: 'HeartConnect Match <info@heartconnect.io.vn>',
            to: [user1.email],
            subject: subject,
            html: createMatchEmail(meta1, meta2)
        }),
        // Gửi cho người 2 (Báo tin về người 1)
        resend.emails.send({
            from: 'HeartConnect Match <info@heartconnect.io.vn>',
            to: [user2.email],
            subject: subject,
            html: createMatchEmail(meta2, meta1)
        })
    ]);

    console.log(`✅ Đã gửi email Match thành công cho: ${user1.email} và ${user2.email}`);
}

// 6. Gửi tin nhắn với tính năng matching
app.post('/api/messages/send', strictLimiter, authenticateToken, async (req, res) => {
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

        // 1. Tìm người nhận trong Supabase Auth (users) bằng vòng lặp phân trang
        let receiverUser = null;
        let hasMore = true;
        let page = 1;

        while (hasMore && !receiverUser) {
            const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers({
                page: page,
                perPage: 1000
            });

            if (listError) {
                console.error('Lỗi lấy danh sách user:', listError);
                break;
            }

            const users = userList.users || [];
            if (users.length === 0) break;

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

            if (users.length < 1000) {
                hasMore = false;
            } else {
                page++;
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
                }
            }
        }

        res.status(201).json({
            success: true,
            isMatch: isMatch,
            // Thay đổi thông báo một chút để người gửi hiểu
            message: isMatch
                ? 'Đã gửi và KẾT NỐI THÀNH CÔNG! Kiểm tra email ngay.'
                : 'Tin nhắn đã được lưu vào hệ thống. Chờ người ấy "bắt sóng"!',
            data: {
                id: newMessage.id,
                receiver: receiverIdentifier,
                type: messageType,
                title,
                sentAt: newMessage.created_at,
                // Email chỉ được gửi nếu có Match
                emailSent: isMatch
            }
        });

    } catch (error) {
        console.error('Lỗi gửi tin nhắn:', error);
        res.status(500).json({ success: false, message: 'Lỗi server, vui lòng thử lại sau' });
    }
});

// Frontend sẽ gọi cái này trước. Nếu nhập Username -> API trả về Email -> Frontend dùng Email login
app.post('/api/auth/lookup-email', strictLimiter, async (req, res) => {
    try {
        const { identifier } = req.body;
        console.log("Đang tra cứu:", identifier);

        if (identifier.includes('@')) {
            return res.json({ success: true, email: identifier });
        }

        let userFound = null;
        let hasMore = true;
        let page = 1;

        while (hasMore && !userFound) {
            const { data: userList, error } = await supabaseAdmin.auth.admin.listUsers({
                page: page,
                perPage: 1000
            });

            if (error) {
                console.error('Lỗi lấy danh sách user:', error);
                break;
            }

            const users = userList.users || [];
            if (users.length === 0) break;

            userFound = users.find(u => {
                const meta = u.user_metadata || {};
                const username = meta.username ? meta.username.toLowerCase() : '';
                const phone = meta.phone || '';
                const search = identifier.toLowerCase();

                return username === search || phone === identifier;
            });

            if (users.length < 1000) {
                hasMore = false;
            } else {
                page++;
            }
        }

        if (userFound) {
            console.log("Tìm thấy user:", userFound.email);
            return res.json({ success: true, email: userFound.email });
        } else {
            console.log("Không tìm thấy user nào khớp.");
            return res.status(404).json({ success: false, message: 'Tài khoản không tồn tại' });
        }
    } catch (error) {
        console.error("Lỗi lookup:", error);
        res.status(500).json({ success: false, message: 'Lỗi server khi tra cứu' });
    }
});

// [SỬA] 7. Lấy tin nhắn đã nhận (Chỉ hiện tin nhắn ĐÃ MATCH)
app.get('/api/messages/inbox', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Lấy tất cả tin nhắn người khác gửi đến mình (Potential Matches)
        const { data: incomingMessages, error: incomingError } = await supabaseAdmin
            .from('messages')
            .select('*')
            .eq('receiver_id', userId)
            .order('created_at', { ascending: false });

        if (incomingError) throw incomingError;

        // 2. Lấy tất cả tin nhắn mình đã gửi đi (để đối chiếu)
        const { data: outgoingMessages, error: outgoingError } = await supabaseAdmin
            .from('messages')
            .select('receiver_id, message_type') // Chỉ cần lấy người nhận và loại tin
            .eq('sender_id', userId);

        if (outgoingError) throw outgoingError;

        // 3. THỰC HIỆN LỌC (MATCHING LOGIC)
        // Chỉ giữ lại những tin nhắn đến mả mình cũng đã gửi lại cho họ (Cùng ID và cùng Loại)
        const matchedMessagesRaw = (incomingMessages || []).filter(inMsg => {
            // Tìm xem mình có gửi tin nào cho người này với cùng loại tin không?
            return outgoingMessages.some(outMsg =>
                outMsg.receiver_id === inMsg.sender_id &&
                outMsg.message_type === inMsg.message_type
            );
        });

        // 4. Format dữ liệu để trả về Frontend (Giống code cũ)
        const formattedMessages = [];
        for (const msg of matchedMessagesRaw) {
            let senderInfo = null;

            if (msg.sender_id && !msg.is_anonymous) {
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
                senderInfo = { fullname: 'Ẩn danh', username: 'anonymous' };
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

// [SỬA] 8.1 API Xóa tin nhắn (Cho phép cả Người gửi và Người nhận xóa)
app.delete('/api/messages/:id', authenticateToken, async (req, res) => {
    try {
        const messageId = req.params.id;
        const userId = req.user.id;

        // Xóa tin nhắn nếu người yêu cầu là Người nhận HOẶC Người gửi
        // Sử dụng cú pháp .or() của Supabase để kiểm tra điều kiện
        const { error } = await supabaseAdmin
            .from('messages')
            .delete()
            .eq('id', messageId)
            .or(`receiver_id.eq.${userId},sender_id.eq.${userId}`);

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