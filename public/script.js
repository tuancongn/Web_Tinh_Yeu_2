// === THÊM KIỂM TRA AN TOÀN ===
if (typeof window.supabase === 'undefined') {
    console.error('❌ LỖI: Supabase chưa được khởi tạo!');
    // Hiển thị thông báo lỗi cho người dùng
    document.body.innerHTML = `
        <div style="text-align: center; padding: 50px; font-family: Arial;">
            <h1 style="color: #ff4d94;">⚠️ Lỗi Khởi Tạo</h1>
            <p>Không thể kết nối đến hệ thống. Vui lòng:</p>
            <ol style="text-align: left; max-width: 500px; margin: 20px auto;">
                <li>Tải lại trang (Ctrl + R)</li>
                <li>Kiểm tra kết nối mạng</li>
                <li>Thử lại sau vài phút</li>
            </ol>
            <button onclick="location.reload()" style="background: #ff4d94; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer;">
                Tải Lại Trang
            </button>
        </div>
    `;
    throw new Error('Supabase not initialized');
}

const supabase = window.supabase;

let currentUser = null;
let selectedMessageType = 'share';
let selectedReceiverMethod = 'username';
let resetMethod = 'email';
let isPasswordRecoveryMode = false;

// Sửa hàm initApp
async function initApp() {
    // Trước tiên, kiểm tra xem có token reset password trong URL không
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const type = urlParams.get('type');
    
    console.log('URL params:', { token, type, isPasswordRecoveryMode });
    
    // Check for an existing session from Supabase
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (session && session.user) {
        // Đã đăng nhập qua Supabase
        currentUser = {
            id: session.user.id,
            email: session.user.email,
            fullname: session.user.user_metadata?.fullname || '',
            username: session.user.user_metadata?.username || '',
            phone: session.user.user_metadata?.phone || '',
            facebook: session.user.user_metadata?.facebook || ''
        };
        localStorage.setItem('heartconnect_current_user', JSON.stringify(currentUser));
        
        showMainContent();
        setupTabSwitching();
        loadProfile();
        loadInbox();
        updateInboxCount();
        
        // Kiểm tra lại nếu đang trong chế độ recovery
        if (isPasswordRecoveryMode) {
            console.log('Đang trong chế độ recovery, hiển thị form reset');
            setTimeout(() => {
                showPasswordResetForm();
            }, 500);
        }
    } else {
        // Chưa đăng nhập
        showAuthContent();
        
        // Nếu có token recovery trong URL, hiển thị thông báo
        if (token && type === 'recovery') {
            showNotification('Thông báo', 'Đang xử lý đặt lại mật khẩu...', 'info');
        }
    }
}

// Lắng nghe sự kiện thay đổi trạng thái Auth
supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth event:', event, 'Has session:', !!session);
    
    if (event === 'PASSWORD_RECOVERY') {
        console.log('PASSWORD_RECOVERY event triggered');
        isPasswordRecoveryMode = true;
        
        // Đợi một chút để chắc chắn initApp đã chạy xong
        setTimeout(() => {
            showPasswordResetForm();
        }, 500);
    } else if (event === 'SIGNED_IN' && isPasswordRecoveryMode) {
        // Nếu đăng nhập thành công trong chế độ recovery
        console.log('SIGNED_IN trong recovery mode');
        
        // Cập nhật currentUser
        if (session && session.user) {
            currentUser = {
                id: session.user.id,
                email: session.user.email,
                fullname: session.user.user_metadata?.fullname || '',
                username: session.user.user_metadata?.username || '',
                phone: session.user.user_metadata?.phone || '',
                facebook: session.user.user_metadata?.facebook || ''
            };
            localStorage.setItem('heartconnect_current_user', JSON.stringify(currentUser));
        }
        
        // Hiển thị form reset password
        setTimeout(() => {
            showPasswordResetForm();
        }, 500);
    }
});

function showPasswordResetForm() {
    // Ẩn tất cả các tab content và form auth
    document.getElementById('auth-container').style.display = 'none';
    
    const tabContents = document.querySelectorAll('.form-section');
    tabContents.forEach(content => {
        content.style.display = 'none';
    });

    // Ẩn phần side-content (sidebar bên phải)
    const sideContents = document.querySelectorAll('.side-content');
    sideContents.forEach(side => {
        side.style.display = 'none';
    });
    
    // Hiển thị main content và đảm bảo nó bắt đầu từ đầu trang
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.style.display = 'block';
        mainContent.style.minHeight = '100vh'; // Đảm bảo full height
        mainContent.style.padding = '0'; // Xóa padding
    }
    
    // Tạo hoặc hiển thị form reset password riêng
    let resetForm = document.getElementById('password-reset-form');
    
    if (!resetForm) {
        resetForm = document.createElement('div');
        resetForm.id = 'password-reset-form';
        resetForm.className = 'form-section active';
        resetForm.style.cssText = `
            display: block;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        `;
        
        resetForm.innerHTML = `
            <div class="form-container" style="
                max-width: 500px; 
                width: 100%;
                padding: 40px; 
                background: white; 
                border-radius: 15px; 
                box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                animation: fadeInUp 0.5s ease;
            ">
                <div style="text-align: center; margin-bottom: 30px;">
                    <div style="
                        width: 80px;
                        height: 80px;
                        background: linear-gradient(135deg, #e74c3c, #ff7675);
                        border-radius: 50%;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        margin-bottom: 20px;
                    ">
                        <i class="fas fa-key" style="font-size: 36px; color: white;"></i>
                    </div>
                    <h2 style="text-align: center; color: #2c3e50; margin-bottom: 10px;">Đặt lại mật khẩu mới</h2>
                    <p style="text-align: center; color: #7f8c8d; margin-bottom: 30px;">
                        Vui lòng nhập mật khẩu mới cho tài khoản của bạn
                    </p>
                </div>
                
                <div class="form-group" style="margin-bottom: 25px;">
                    <label for="new-password" style="display: block; margin-bottom: 10px; font-weight: 600; color: #2c3e50;">
                        <i class="fas fa-lock" style="margin-right: 8px;"></i>
                        Mật khẩu mới *
                    </label>
                    <input type="password" id="new-password" placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)" 
                           style="width: 100%; padding: 14px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 16px; transition: all 0.3s;"
                           onfocus="this.style.borderColor='#e74c3c';"
                           onblur="this.style.borderColor='#e0e0e0';">
                    <div style="font-size: 13px; color: #7f8c8d; margin-top: 5px;">
                        Mật khẩu phải có ít nhất 6 ký tự
                    </div>
                </div>
                
                <div class="form-group" style="margin-bottom: 35px;">
                    <label for="confirm-new-password" style="display: block; margin-bottom: 10px; font-weight: 600; color: #2c3e50;">
                        <i class="fas fa-lock" style="margin-right: 8px;"></i>
                        Xác nhận mật khẩu mới *
                    </label>
                    <input type="password" id="confirm-new-password" placeholder="Nhập lại mật khẩu mới để xác nhận" 
                           style="width: 100%; padding: 14px 16px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 16px; transition: all 0.3s;"
                           onfocus="this.style.borderColor='#e74c3c';"
                           onblur="this.style.borderColor='#e0e0e0';">
                </div>
                
                <div class="form-actions" style="display: flex; gap: 15px; margin-bottom: 25px;">
                    <button type="button" class="btn btn-primary" onclick="submitNewPassword()" 
                            style="flex: 1; padding: 16px; background: linear-gradient(135deg, #e74c3c, #ff7675); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s;"
                            onmouseover="this.style.transform='translateY(-2px)'; box-shadow='0 5px 15px rgba(231, 76, 60, 0.4)';"
                            onmouseout="this.style.transform='translateY(0)'; box-shadow='none';">
                        <i class="fas fa-check-circle" style="margin-right: 8px;"></i>
                        Đổi mật khẩu
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="cancelPasswordReset()"
                            style="flex: 1; padding: 16px; background: #f8f9fa; color: #6c757d; border: 2px solid #e9ecef; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s;"
                            onmouseover="this.style.background='#e9ecef'; borderColor='#dee2e6'; transform='translateY(-2px)';"
                            onmouseout="this.style.background='#f8f9fa'; borderColor='#e9ecef'; transform='translateY(0)';">
                        <i class="fas fa-times" style="margin-right: 8px;"></i>
                        Hủy bỏ
                    </button>
                </div>
                
                <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee;">
                    <p style="color: #7f8c8d; font-size: 14px; margin-bottom: 5px;">
                        <i class="fas fa-info-circle" style="margin-right: 5px; color: #3498db;"></i>
                        Sau khi đổi mật khẩu, bạn sẽ được đăng nhập tự động
                    </p>
                    <p style="color: #7f8c8d; font-size: 14px;">
                        <i class="fas fa-shield-alt" style="margin-right: 5px; color: #2ecc71;"></i>
                        Mật khẩu của bạn được mã hóa và bảo mật an toàn
                    </p>
                </div>
            </div>
        `;
        
        if (mainContent) {
            // Đảm bảo form được thêm vào đầu main-content
            if (mainContent.firstChild) {
                mainContent.insertBefore(resetForm, mainContent.firstChild);
            } else {
                mainContent.appendChild(resetForm);
            }
        }
    }
    
    resetForm.style.display = 'flex';
    
    // Ẩn các tab navigation
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Cuộn trang lên đầu để đảm bảo form hiển thị ngay lập tức
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
    
    // Focus vào input đầu tiên
    setTimeout(() => {
        const passwordInput = document.getElementById('new-password');
        if (passwordInput) {
            passwordInput.focus();
        }
    }, 300);
}

function cancelPasswordReset() {
    isPasswordRecoveryMode = false;
    
    // Xóa form reset
    const resetForm = document.getElementById('password-reset-form');
    if (resetForm) {
        resetForm.remove();
    }
    
    // Hiển thị lại các tab navigation
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.style.display = 'flex';
    });
    
    // Hiển thị lại side-content
    const sideContents = document.querySelectorAll('.side-content');
    sideContents.forEach(side => {
        side.style.display = '';
    });
    
    // Hiển thị lại footer
    const footer = document.querySelector('footer');
    if (footer) {
        footer.style.display = '';
    }
    
    // Hiển thị lại header
    const header = document.querySelector('header');
    if (header) {
        header.style.display = '';
    }
    
    // Hiển thị lại các phần con của main-content
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.style.minHeight = '';
        mainContent.style.padding = '';
        
        const mainContentChildren = mainContent.querySelectorAll(':scope > *');
        mainContentChildren.forEach(child => {
            if (child.id !== 'password-reset-form') {
                child.style.display = '';
            }
        });
    }
    
    // Hiển thị trang đăng nhập
    showAuthContent();
}

async function submitNewPassword() {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;
    
    if (!newPassword || !confirmPassword) {
        showNotification('Lỗi', 'Vui lòng nhập đầy đủ mật khẩu!', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('Lỗi', 'Mật khẩu xác nhận không khớp!', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification('Lỗi', 'Mật khẩu phải có ít nhất 6 ký tự!', 'error');
        return;
    }
    
    try {
        // Update password trong Supabase
        const { error: updateError } = await supabase.auth.updateUser({
            password: newPassword
        });
        
        if (updateError) throw updateError;
        
        showNotification('Thành công', 'Mật khẩu đã được thay đổi thành công!', 'success');
        
        // Tắt chế độ recovery
        isPasswordRecoveryMode = false;
        
        // Xóa form reset
        const resetForm = document.getElementById('password-reset-form');
        if (resetForm) {
            resetForm.remove();
        }
        
        // Hiển thị lại các phần đã ẩn (giống như cancelPasswordReset)
        const sideContents = document.querySelectorAll('.side-content');
        sideContents.forEach(side => {
            side.style.display = '';
        });
        
        const footer = document.querySelector('footer');
        if (footer) {
            footer.style.display = '';
        }
        
        const header = document.querySelector('header');
        if (header) {
            header.style.display = '';
        }
        
        // Hiển thị lại các phần con của main-content
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.style.minHeight = '';
            mainContent.style.padding = '';
            
            const mainContentChildren = mainContent.querySelectorAll(':scope > *');
            mainContentChildren.forEach(child => {
                child.style.display = '';
            });
        }
        
        // Hiển thị lại các tab navigation
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.style.display = 'flex';
        });
        
        // Reload trang để cập nhật trạng thái đăng nhập
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
        
    } catch (error) {
        console.error('Lỗi đổi mật khẩu:', error);
        showNotification('Lỗi', 'Không thể đổi mật khẩu: ' + error.message, 'error');
    }
}

// Hiển thị phần đăng ký/đăng nhập
function showAuthContent() {
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('main-content').style.display = 'none';
}

// Hiển thị nội dung chính
function showMainContent() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';
    
    // Hiển thị lại các tab navigation (nếu đã bị ẩn bởi showPasswordResetForm)
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.style.display = 'flex';
    });
}

// Chuyển tab đăng nhập/đăng ký/quên mật khẩu
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => {
        t.classList.remove('active');
    });
    
    if (tab === 'login') {
        document.querySelector('.auth-tab:nth-child(1)').classList.add('active');
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('forgot-form').style.display = 'none';
    } else if (tab === 'register') {
        document.querySelector('.auth-tab:nth-child(2)').classList.add('active');
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
        document.getElementById('forgot-form').style.display = 'none';
    } else {
        document.querySelector('.auth-tab:nth-child(3)').classList.add('active');
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('forgot-form').style.display = 'block';
    }
}

// Chọn phương thức khôi phục mật khẩu
function selectResetMethod(element, method) {
    document.querySelectorAll('.reset-option').forEach(el => {
        el.classList.remove('selected');
    });
    
    element.classList.add('selected');
    resetMethod = method;
    
    const icon = document.getElementById('reset-icon');
    const label = document.getElementById('reset-label');
    const input = document.getElementById('reset-identifier');
    
    if (method === 'email') {
        icon.className = 'fas fa-envelope';
        label.textContent = 'Nhập email của bạn';
        input.placeholder = 'Nhập email của bạn';
    } else {
        icon.className = 'fas fa-phone';
        label.textContent = 'Nhập số điện thoại của bạn';
        input.placeholder = 'Nhập số điện thoại của bạn';
    }
}

async function register() {
    const fullname = document.getElementById('register-fullname').value.trim();
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const phone = document.getElementById('register-phone').value.trim();
    const facebook = document.getElementById('register-facebook').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    // Validate
    if (!fullname || !username || !email || !phone || !facebook || !password || !confirmPassword) {
        showNotification('Lỗi', 'Vui lòng điền đầy đủ thông tin bắt buộc!', 'error');
        return;
    }
    
    if (!email.includes('@')) {
        showNotification('Lỗi', 'Email không hợp lệ!', 'error');
        return;
    }
    
    if (!facebook.includes('facebook.com')) {
        showNotification('Lỗi', 'Link Facebook không hợp lệ! Vui lòng nhập link Facebook đầy đủ.', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Lỗi', 'Mật khẩu phải có ít nhất 6 ký tự!', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Lỗi', 'Mật khẩu xác nhận không khớp!', 'error');
        return;
    }
    
    try {
        // 1. Sign up the user with Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { // This stores additional user info in `user_metadata`
                    fullname: fullname,
                    username: username,
                    phone: phone,
                    facebook: facebook
                }
            }
        });

        if (error) throw error;

        // 2. Check if email confirmation is required
        if (data.user?.identities?.length === 0) {
            showNotification('Lỗi', 'Email này đã được đăng ký.', 'error');
            return;
        }
        
        if (data.session) {
            // Immediate login on successful sign-up (if email confirmation is disabled in Supabase settings)
            currentUser = {
                id: data.user.id,
                email: data.user.email,
                fullname: fullname,
                username: username,
                phone: phone,
                facebook: facebook
            };
            localStorage.setItem('heartconnect_current_user', JSON.stringify(currentUser));
            
            showNotification('Thành công', 'Đăng ký tài khoản thành công!', 'success');
            showMainContent();
            loadProfile();
        } else {
            // Email confirmation sent
            showNotification('Thành công', 'Vui lòng kiểm tra email để xác nhận tài khoản!', 'success');
        }
        
    } catch (error) {
        console.error('Register error:', error);
        showNotification('Lỗi', error.message || 'Đăng ký thất bại!', 'error');
    }
}

// Thay thế hàm login() cũ
async function login() {
    const identifier = document.getElementById('login-identifier').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!identifier || !password) {
        showNotification('Lỗi', 'Vui lòng nhập thông tin đăng nhập!', 'error');
        return;
    }

    try {
        let emailToLogin = identifier;

        // Bước 1: Nếu không phải email (tức là username hoặc sđt), gọi API tra cứu email
        if (!identifier.includes('@')) {
            showNotification('Thông báo', 'Đang kiểm tra thông tin...', 'info');
            
            // Gọi API lookup mới thêm ở backend
            const response = await fetch('/api/auth/lookup-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier })
            });
            
            const data = await response.json();
            if (!data.success) {
                throw new Error('Tài khoản không tồn tại trong hệ thống');
            }
            emailToLogin = data.email;
        }

        // Bước 2: Đăng nhập bằng Email (chính chủ hoặc email vừa tìm được)
        const { data, error } = await supabase.auth.signInWithPassword({
            email: emailToLogin,
            password: password
        });

        if (error) throw error;

        // Đăng nhập thành công
        currentUser = {
            id: data.user.id,
            email: data.user.email,
            fullname: data.user.user_metadata?.fullname || '',
            username: data.user.user_metadata?.username || '',
            phone: data.user.user_metadata?.phone || '',
            facebook: data.user.user_metadata?.facebook || ''
        };
        localStorage.setItem('heartconnect_current_user', JSON.stringify(currentUser));
        
        showNotification('Thành công', 'Đăng nhập thành công!', 'success');
        showMainContent();
        loadProfile();
        loadInbox();
        
    } catch (error) {
        console.error('Login error:', error);
        // Hiển thị lỗi rõ ràng hơn
        let msg = 'Email hoặc mật khẩu không đúng!';
        if (error.message.includes('Tài khoản không tồn tại')) msg = error.message;
        showNotification('Lỗi', msg, 'error');
    }
}

async function resetPassword() {
    const identifier = document.getElementById('reset-identifier').value.trim();
    if (!identifier) {
        showNotification('Lỗi', 'Vui lòng nhập email khôi phục!', 'error');
        return;
    }
    try {
        // Gửi email reset, liên kết sẽ dẫn về chính trang chủ của bạn
        const { error } = await supabase.auth.resetPasswordForEmail(identifier, {
            redirectTo: window.location.origin,
        });
        if (error) throw error;
        showNotification('Thành công', 'Email khôi phục đã được gửi! Vui lòng kiểm tra hộp thư.', 'success');
    } catch (error) {
        showNotification('Lỗi', error.message || 'Không thể gửi email!', 'error');
    }
}

async function logout() {
    if (confirm('Bạn có chắc muốn đăng xuất?')) {
        await supabase.auth.signOut();
        currentUser = null;
        localStorage.removeItem('heartconnect_current_user');
        showAuthContent();
        showNotification('Thông tin', 'Đã đăng xuất thành công!', 'info');
    }
}

// Thiết lập chuyển tab
function setupTabSwitching() {
    const tabs = document.querySelectorAll('.tab[data-tab]');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // Cập nhật tab active
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Hiển thị form tương ứng
            document.querySelectorAll('.form-section').forEach(form => {
                form.classList.remove('active');
            });
            document.getElementById(`${tabId}-form`).classList.add('active');
            
            // Nếu là tab inbox, load lại tin nhắn
            if (tabId === 'inbox') {
                loadInbox();
            }
            
            // Nếu là tab profile, load lại thông tin
            if (tabId === 'profile') {
                loadProfile();
            }
        });
    });
}

// Tải thông tin profile
function loadProfile() {
    if (currentUser) {
        document.getElementById('profile-name').textContent = currentUser.fullname;
        document.getElementById('profile-username').textContent = '@' + currentUser.username;
        document.getElementById('profile-avatar').textContent = currentUser.fullname.charAt(0).toUpperCase();
        
        document.getElementById('profile-username-display').textContent = '@' + currentUser.username;
        document.getElementById('profile-fullname-display').textContent = currentUser.fullname;
        document.getElementById('profile-email-display').textContent = currentUser.email;
        document.getElementById('profile-phone-display').textContent = currentUser.phone;
        
        if (currentUser.facebook) {
            document.getElementById('profile-facebook-display').innerHTML = 
                `<a href="${currentUser.facebook}" target="_blank" style="color: #1877f2;">${currentUser.facebook}</a>`;
        } else {
            document.getElementById('profile-facebook-display').textContent = 'Chưa có';
        }
    }
}

// Hiển thị form chỉnh sửa hồ sơ
function showEditProfile() {
    if (currentUser) {
        // Điền thông tin hiện tại vào form
        document.getElementById('edit-fullname').value = currentUser.fullname;
        document.getElementById('edit-email').value = currentUser.email;
        document.getElementById('edit-phone').value = currentUser.phone;
        document.getElementById('edit-facebook').value = currentUser.facebook;
        
        // Ẩn phần xem, hiển thị phần chỉnh sửa
        document.getElementById('view-profile').style.display = 'none';
        document.getElementById('edit-profile').classList.add('active');
    }
}

// Hủy chỉnh sửa hồ sơ
function cancelEditProfile() {
    document.getElementById('view-profile').style.display = 'block';
    document.getElementById('edit-profile').classList.remove('active');
}

async function updateProfile() {
    if (!currentUser) return;
    
    const fullname = document.getElementById('edit-fullname').value.trim();
    const email = document.getElementById('edit-email').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();
    const facebook = document.getElementById('edit-facebook').value.trim();
    const password = document.getElementById('edit-password').value;
    const confirmPassword = document.getElementById('edit-confirm-password').value;
    
    // Validate
    if (!fullname || !email || !phone || !facebook) {
        showNotification('Lỗi', 'Vui lòng điền đầy đủ thông tin bắt buộc!', 'error');
        return;
    }
    
    if (!email.includes('@')) {
        showNotification('Lỗi', 'Email không hợp lệ!', 'error');
        return;
    }
    
    if (!facebook.includes('facebook.com')) {
        showNotification('Lỗi', 'Link Facebook không hợp lệ! Vui lòng nhập link Facebook đầy đủ.', 'error');
        return;
    }
    
    // Nếu đang trong chế độ recovery, chuyển sang xử lý đổi mật khẩu
    if (isPasswordRecoveryMode) {
        const password = document.getElementById('edit-password').value;
        const confirmPassword = document.getElementById('edit-confirm-password').value;
        
        if (password) {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            });
            
            if (updateError) {
                console.error('Lỗi đổi mật khẩu:', updateError);
                showNotification('Lỗi', 'Không thể đổi mật khẩu: ' + updateError.message, 'error');
                return;
            }
            
            showNotification('Thành công', 'Mật khẩu đã được thay đổi!', 'success');
            
            // Tắt chế độ recovery sau khi đổi mật khẩu thành công
            isPasswordRecoveryMode = false;
            
            // Chuyển về tab inbox
            document.querySelector('.tab[data-tab="inbox"]').click();
        }
        return;
    }
    
    try {
        // 1. Update the user's metadata in Supabase Auth
        const { data, error } = await supabase.auth.updateUser({
            data: {
                fullname: fullname,
                phone: phone,
                facebook: facebook
                // Note: Supabase does not allow updating `email` via `updateUser` directly for metadata.
                // Changing email requires a separate email change flow.
            }
        });

        if (error) throw error;

        // 2. Update the local currentUser object
        currentUser.fullname = fullname;
        currentUser.phone = phone;
        currentUser.facebook = facebook;
        localStorage.setItem('heartconnect_current_user', JSON.stringify(currentUser));
        
        // 3. Update the UI and show notification
        loadProfile();
        cancelEditProfile();
        showNotification('Thành công', 'Đã cập nhật thông tin hồ sơ!', 'success');
        
    } catch (error) {
        console.error('Update profile error:', error);
        showNotification('Lỗi', error.message || 'Cập nhật thất bại!', 'error');
    }
}

// Chọn loại tin nhắn
function selectMessageType(element, type) {
    document.querySelectorAll('.message-type').forEach(el => {
        el.classList.remove('selected');
    });
    
    element.classList.add('selected');
    selectedMessageType = type;
    
    const textarea = document.getElementById('message-content');
    const placeholders = {
        'share': 'Viết những tâm sự, suy nghĩ của bạn...\nVí dụ: "Có những điều mình muốn chia sẻ với bạn đã lâu..."',
        'confess': 'Viết tình cảm của bạn một cách chân thành...\nVí dụ: "Mình muốn nói rằng mình có tình cảm đặc biệt với bạn..."',
        'reconnect': 'Viết mong muốn được quay lại...\nVí dụ: "Mình đã suy nghĩ rất nhiều và muốn chúng ta thử lại một lần nữa..."'
    };
    
    textarea.placeholder = placeholders[type] || 'Viết những gì bạn muốn nói...';
}

// Chọn phương thức gửi
function selectReceiverMethod(element, method) {
    document.querySelectorAll('.receiver-method').forEach(el => {
        el.classList.remove('selected');
    });
    
    element.classList.add('selected');
    selectedReceiverMethod = method;
    
    const input = document.getElementById('receiver-input');
    const placeholders = {
        'username': 'Nhập username của người nhận (ví dụ: nguyenvana)',
        'email': 'Nhập email của người nhận (ví dụ: example@gmail.com)',
        'phone': 'Nhập số điện thoại của người nhận (ví dụ: 0987654321)',
        'facebook': 'Nhập link Facebook của người nhận (ví dụ: https://facebook.com/username)'
    };
    
    input.placeholder = placeholders[method] || 'Nhập thông tin người nhận...';
}

// Xem trước tin nhắn
function previewMessage() {
    // Kiểm tra đã đăng nhập chưa
    if (!currentUser) {
        showNotification('Lỗi', 'Vui lòng đăng nhập trước!', 'error');
        return;
    }
    
    // Kiểm tra có Facebook không
    if (!currentUser.facebook) {
        showNotification('Lỗi', 'Vui lòng cập nhật link Facebook trong hồ sơ trước khi gửi tin nhắn!', 'error');
        document.querySelector('.tab[data-tab="profile"]').click();
        return;
    }
    
    // Lấy thông tin
    const receiver = document.getElementById('receiver-input').value.trim();
    const title = document.getElementById('message-title').value.trim();
    const content = document.getElementById('message-content').value.trim();
    const anonymous = document.getElementById('anonymous').value;
    const sendInbox = document.getElementById('send-inbox').checked;
    const sendEmail = document.getElementById('send-email').checked;
    const sendSms = document.getElementById('send-sms').checked;
    
    // Validate
    if (!receiver) {
        showNotification('Lỗi', 'Vui lòng nhập thông tin người nhận!', 'error');
        return;
    }
    
    if (!title || !content) {
        showNotification('Lỗi', 'Vui lòng nhập tiêu đề và nội dung tin nhắn!', 'error');
        return;
    }
    
    if (!sendInbox && !sendEmail && !sendSms) {
        showNotification('Lỗi', 'Vui lòng chọn ít nhất một kênh gửi!', 'error');
        return;
    }
    
    // Xác định tên loại tin nhắn
    const typeNames = {
        'share': 'Lời tâm sự',
        'confess': 'Bày tỏ tình cảm',
        'reconnect': 'Muốn quay lại'
    };
    
    const typeName = typeNames[selectedMessageType] || 'Tin nhắn';
    
    // Xác định phương thức gửi
    const methodNames = {
        'username': 'Username',
        'email': 'Email',
        'phone': 'Số điện thoại',
        'facebook': 'Facebook'
    };
    
    const methodName = methodNames[selectedReceiverMethod] || 'Không xác định';
    
    // Xác định kênh gửi
    const channels = [];
    if (sendInbox) channels.push('Hộp thư website');
    if (sendEmail) channels.push('Email');
    if (sendSms) channels.push('SMS');
    const channelsText = channels.join(', ');
    
    // Xác định người gửi
    const senderName = anonymous === 'yes' ? 'Ẩn danh' : currentUser.fullname;
    
    // Tạo nội dung preview
    const previewHTML = `
        <div class="preview-meta">
            <div class="preview-item">
                <i class="fas fa-user"></i>
                <strong>Người gửi:</strong> ${senderName}
            </div>
            <div class="preview-item">
                <i class="fas fa-user-check"></i>
                <strong>Gửi đến:</strong> ${receiver} (qua ${methodName})
            </div>
            <div class="preview-item">
                <i class="fas fa-heart"></i>
                <strong>Loại tin nhắn:</strong> ${typeName}
            </div>
            <div class="preview-item">
                <i class="fas fa-paper-plane"></i>
                <strong>Gửi qua:</strong> ${channelsText}
            </div>
        </div>
        
        <div class="preview-subject">${title || '[Chưa có tiêu đề]'}</div>
        
        <div class="preview-body">${content || '[Chưa có nội dung]'}</div>
        
        <div class="preview-footer">
            <div>
                <i class="fab fa-facebook"></i>
                Link Facebook của bạn sẽ được tự động thêm vào tin nhắn
            </div>
            <div>
                <i class="fas fa-clock"></i>
                ${new Date().toLocaleString('vi-VN')}
            </div>
        </div>
    `;
    
    // Hiển thị preview
    document.getElementById('preview-content').innerHTML = previewHTML;
    document.getElementById('preview-section').style.display = 'block';
    document.getElementById('send-button').style.display = 'none';
    
    // Cuộn đến phần preview
    document.getElementById('preview-section').scrollIntoView({ behavior: 'smooth' });
}

// Đóng preview
function closePreview() {
    document.getElementById('preview-section').style.display = 'none';
    document.getElementById('send-button').style.display = 'block';
}

// Gửi tin nhắn
function sendMessage() {
    // Kiểm tra đã đăng nhập chưa
    if (!currentUser) {
        showNotification('Lỗi', 'Vui lòng đăng nhập trước!', 'error');
        return;
    }
    
    // Kiểm tra có Facebook không
    if (!currentUser.facebook) {
        showNotification('Lỗi', 'Vui lòng cập nhật link Facebook trong hồ sơ trước khi gửi tin nhắn!', 'error');
        document.querySelector('.tab[data-tab="profile"]').click();
        return;
    }
    
    // Lấy thông tin
    const receiver = document.getElementById('receiver-input').value.trim();
    const title = document.getElementById('message-title').value.trim();
    const content = document.getElementById('message-content').value.trim();
    const anonymous = document.getElementById('anonymous').value;
    const sendInbox = document.getElementById('send-inbox').checked;
    const sendEmail = document.getElementById('send-email').checked;
    const sendSms = document.getElementById('send-sms').checked;
    
    // Validate
    if (!receiver) {
        showNotification('Lỗi', 'Vui lòng nhập thông tin người nhận!', 'error');
        return;
    }
    
    if (!title || !content) {
        showNotification('Lỗi', 'Vui lòng nhập tiêu đề và nội dung tin nhắn!', 'error');
        return;
    }
    
    if (!sendInbox && !sendEmail && !sendSms) {
        showNotification('Lỗi', 'Vui lòng chọn ít nhất một kênh gửi!', 'error');
        return;
    }
    
    // Thêm link Facebook vào nội dung
    const finalContent = content + `\n\n---\n📱 Kết nối với mình trên Facebook: ${currentUser.facebook}`;
    
    // Tạo tin nhắn
    const message = {
        id: Date.now(),
        sender: {
            fullname: anonymous === 'yes' ? 'Ẩn danh' : currentUser.fullname,
            username: anonymous === 'yes' ? 'anonymous' : currentUser.username,
            email: currentUser.email,
            phone: currentUser.phone,
            facebook: currentUser.facebook
        },
        receiver: {
            method: selectedReceiverMethod,
            value: receiver
        },
        message: {
            type: selectedMessageType,
            title: title,
            content: finalContent,
            hasFacebookLink: true
        },
        channels: {
            inbox: sendInbox,
            email: sendEmail,
            sms: sendSms
        },
        timestamp: new Date().toLocaleString('vi-VN'),
        status: 'sent',
        read: false
    };
    
    // Lưu tin nhắn đã gửi
    sentMessages.push(message);
    localStorage.setItem('heartconnect_sent', JSON.stringify(sentMessages));
    
    // Giả lập gửi tin nhắn đến người nhận
    simulateMessageDelivery(message);
    
    // Reset form
    document.getElementById('receiver-input').value = '';
    document.getElementById('message-title').value = '';
    document.getElementById('message-content').value = '';
    
    // Đóng preview
    closePreview();
    
    showNotification('Thành công', 'Đã gửi tin nhắn thành công!', 'success');
}

// Giả lập gửi tin nhắn đến người nhận
function simulateMessageDelivery(message) {
    // Tìm user nhận (giả lập)
    let receiverUser;
    if (selectedReceiverMethod === 'username') {
        receiverUser = users.find(u => u.username === message.receiver.value);
    } else if (selectedReceiverMethod === 'email') {
        receiverUser = users.find(u => u.email === message.receiver.value);
    } else if (selectedReceiverMethod === 'phone') {
        receiverUser = users.find(u => u.phone === message.receiver.value);
    } else if (selectedReceiverMethod === 'facebook') {
        receiverUser = users.find(u => u.facebook.includes(message.receiver.value));
    }
    
    if (receiverUser) {
        // Tạo tin nhắn trong hộp thư đến của người nhận
        const receivedMessage = {
            id: Date.now() + 1,
            sender: {
                fullname: message.sender.fullname,
                username: message.sender.username,
                email: message.sender.email,
                phone: message.sender.phone,
                facebook: message.sender.facebook
            },
            receiver: {
                method: 'username',
                value: receiverUser.username
            },
            message: {
                type: message.message.type,
                title: message.message.title,
                content: message.message.content,
                hasFacebookLink: true
            },
            timestamp: new Date().toLocaleString('vi-VN'),
            read: false
        };
        
        // Thêm vào hộp thư đến (giả lập)
        console.log('Tin nhắn đã gửi đến:', receiverUser.fullname);
    }
    
    // Log thông tin gửi
    console.log('Tin nhắn đã gửi:', {
        receiver: message.receiver,
        channels: message.channels,
        hasFacebookLink: true
    });
}

async function loadInbox() {
    const container = document.getElementById('inbox-container');
    
    if (!currentUser) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-envelope-open"></i>
                </div>
                <h3>Vui lòng đăng nhập</h3>
                <p>Đăng nhập để xem tin nhắn của bạn.</p>
            </div>
        `;
        return;
    }
    
    try {
        // Lấy session token từ Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Chưa đăng nhập');
        
const response = await fetch(`/api/messages/inbox`, {
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${session.access_token}`
    }
});
        
        const data = await response.json();
        
        if (data.success) {
            if (data.messages && data.messages.length > 0) {
                // Hiển thị tin nhắn
                let messagesHTML = '';
                data.messages.forEach(msg => {
                    const messageType = {
                        'share': 'Lời tâm sự',
                        'confess': 'Bày tỏ tình cảm',
                        'reconnect': 'Muốn quay lại'
                    }[msg.messageType] || 'Tin nhắn';
                    
                    messagesHTML += `
                        <div class="message-item">
                            <div class="message-header">
                                <div class="message-sender">
                                    <i class="fas fa-user"></i>
                                    ${msg.sender.fullname}
                                </div>
                                <div class="message-time">
                                    <i class="fas fa-clock"></i>
                                    ${new Date(msg.createdAt).toLocaleString('vi-VN')}
                                </div>
                            </div>
                            <div class="message-type-badge">${messageType}</div>
                            <div class="message-title">${msg.title}</div>
                            <div class="message-content">${msg.content}</div>
                        </div>
                    `;
                });
                
                container.innerHTML = messagesHTML;
                updateInboxCount(data.messages.length);
            } else {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">
                            <i class="fas fa-envelope-open"></i>
                        </div>
                        <h3>Hộp thư trống</h3>
                        <p>Bạn chưa có tin nhắn nào. Khi ai đó gửi tin nhắn cho bạn, nó sẽ xuất hiện ở đây.</p>
                    </div>
                `;
                updateInboxCount(0);
            }
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3>Lỗi tải tin nhắn</h3>
                    <p>${data.message || 'Không thể tải tin nhắn'}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Load inbox error:', error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3>Lỗi kết nối</h3>
                <p>Không thể kết nối đến server.</p>
            </div>
        `;
    }
}

// Cập nhật số lượng tin nhắn
function updateInboxCount(count = 0) {
    const badge = document.getElementById('inbox-count');
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// Hiển thị thông báo
function showNotification(title, message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationTitle = document.getElementById('notification-title');
    const notificationMessage = document.getElementById('notification-message');
    
    // Đặt màu sắc theo loại thông báo
    const colors = {
        'success': '#4dff88',
        'error': '#ff4d4d',
        'info': '#4dabf7'
    };
    
    notification.style.borderLeftColor = colors[type] || '#4dabf7';
    
    notificationTitle.textContent = title;
    notificationMessage.textContent = message;
    
    notification.style.display = 'block';
    
    // Tự động ẩn sau 5 giây
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

// Đóng thông báo
function closeNotification() {
    document.getElementById('notification').style.display = 'none';
}