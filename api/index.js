const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

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

// Serve static files from client directory
const path = require('path');

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
    const subject = "💘 TƯƠNG TƯ HỮU Ý - KẾT NỐI THÀNH CÔNG!";
    
    // Nội dung email cho người 1
    const html1 = `
        <h1>Chúc mừng ${user1.metadata.fullname}!</h1>
        <p>Bạn và <strong>${user2.metadata.fullname}</strong> đều đã gửi tín hiệu <strong>"${messageType}"</strong> cho nhau.</p>
        <p>Hệ thống HeartConnect xác nhận hai bạn đã "Bắt được sóng" của nhau.</p>
        <p>Hãy liên hệ với nhau ngay qua Facebook: <a href="${user2.metadata.facebook}">${user2.metadata.facebook}</a></p>
    `;

    // Nội dung email cho người 2
    const html2 = `
        <h1>Chúc mừng ${user2.metadata.fullname}!</h1>
        <p>Bạn và <strong>${user1.metadata.fullname}</strong> đều đã gửi tín hiệu <strong>"${messageType}"</strong> cho nhau.</p>
        <p>Hệ thống HeartConnect xác nhận hai bạn đã "Bắt được sóng" của nhau.</p>
        <p>Hãy liên hệ với nhau ngay qua Facebook: <a href="${user1.metadata.facebook}">${user1.metadata.facebook}</a></p>
    `;

    // Gửi song song 2 email
    await Promise.all([
        resend.emails.send({ from: 'HeartConnect <info@heartconnect.io.vn>', to: [user1.email], subject, html: html1 }),
        resend.emails.send({ from: 'HeartConnect <info@heartconnect.io.vn>', to: [user2.email], subject, html: html2 })
    ]);
}

// 6. Gửi tin nhắn
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
                // Tìm user theo email (có sẵn trong auth.users)
                const { data, error } = await supabaseAdmin.auth.admin.getUserByEmail(
                    receiverIdentifier.toLowerCase()
                );
                if (!error && data.user) {
                    receiverUser = data.user;
                }
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
        
        // 5. Gửi email thông báo tin nhắn mới (nếu được bật và receiverMethod là email)
        // Chỉ gửi nếu KHÔNG có match (vì match đã gửi email riêng)
        if (!isMatch && channels && channels.email && receiverMethod === 'email') {
            try {
                await resend.emails.send({
                    from: 'HeartConnect <info@heartconnect.io.vn>',
                    to: [receiverIdentifier],
                    subject: `[HeartConnect] ${title}`,
                    html: `
                        <h2>Bạn nhận được tin nhắn mới từ HeartConnect!</h2>
                        <p><strong>Tiêu đề:</strong> ${title}</p>
                        <p><strong>Nội dung:</strong> ${content}</p>
                        <p><strong>Loại tin nhắn:</strong> ${messageType}</p>
                        ${isAnonymous ? '<p><em>Người gửi đã chọn ẩn danh</em></p>' : ''}
                        <hr>
                        <p><small>Đăng nhập vào HeartConnect để xem chi tiết và phản hồi.</small></p>
                    `
                });
            } catch (emailError) {
                console.error("Lỗi gửi mail Resend:", emailError);
                // Không return lỗi để flow chính vẫn thành công
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
                receiverFound: !!receiverUser
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
        const { identifier } = req.body; // Username hoặc Email hoặc Phone
        
        // Nếu là email thì trả về luôn
        if (identifier.includes('@')) {
            return res.json({ success: true, email: identifier });
        }

        // Nếu không phải email, tìm trong User Metadata
        const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
        const user = userList.users.find(u => 
            u.user_metadata?.username === identifier.toLowerCase() || 
            u.user_metadata?.phone === identifier
        );

        if (user) {
            return res.json({ success: true, email: user.email });
        } else {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi tra cứu thông tin' });
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

// Khởi động server
const PORT = process.env.PORT || 5000;
module.exports = app;