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

// Hàm chống XSS chèn mã độc HTML
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

let currentUser = null;
let selectedMessageType = 'share';
let selectedReceiverMethod = 'username';
let resetMethod = 'email';
let isPasswordRecoveryMode = false;

// Sửa hàm initApp
async function initApp() {
    console.log("🚀 Đang khởi động ứng dụng...");

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const type = urlParams.get('type');

    console.log('URL params:', { token, type, isPasswordRecoveryMode });

    const { data: { session }, error } = await supabase.auth.getSession();

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

    // Reset tabs
    document.querySelectorAll('.tab').forEach(t => t.style.display = 'flex');
    // Mặc định vào tab gửi tin
    document.querySelector('.tab[data-tab="send"]').click();
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
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    fullname: fullname,
                    username: username,
                    phone: phone,
                    facebook: facebook
                }
            }
        });

        if (error) throw error;

        if (data.user?.identities?.length === 0) {
            showNotification('Lỗi', 'Email này đã được đăng ký.', 'error');
            return;
        }

        if (data.session) {
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
        await initApp();

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
        window.location.reload(); // Reload để reset sạch sẽ
    }
}

// Thiết lập chuyển tab
function setupTabSwitching() {
    const tabs = document.querySelectorAll('.tab[data-tab]');
    tabs.forEach(tab => {

        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);

        newTab.addEventListener('click', function () {
            const tabId = this.getAttribute('data-tab');
            console.log("Chuyển tab:", tabId);

            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Hiển thị form tương ứng
            document.querySelectorAll('.form-section').forEach(form => {
                form.classList.remove('active');
            });
            const targetForm = document.getElementById(`${tabId}-form`);
            if (targetForm) targetForm.classList.add('active');

            if (tabId === 'inbox') loadInbox();
            if (tabId === 'profile') loadProfile();
            if (tabId === 'sent') loadSentMessages();
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
                <strong>Người gửi:</strong> ${escapeHTML(senderName)}
            </div>
            <div class="preview-item">
                <i class="fas fa-user-check"></i>
                <strong>Gửi đến:</strong> ${escapeHTML(receiver)} (qua ${methodName})
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
        
        <div class="preview-subject">${escapeHTML(title) || '[Chưa có tiêu đề]'}</div>
        
        <div class="preview-body">${escapeHTML(content) || '[Chưa có nội dung]'}</div>
        
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

// [SỬA] Hàm gửi tin nhắn (Gọi API Backend)
async function sendMessage() {
    // 1. Kiểm tra đăng nhập
    if (!currentUser) {
        showNotification('Lỗi', 'Vui lòng đăng nhập trước!', 'error');
        return;
    }

    // 2. Lấy dữ liệu từ Form
    const receiver = document.getElementById('receiver-input').value.trim();
    const title = document.getElementById('message-title').value.trim();
    const content = document.getElementById('message-content').value.trim();
    const anonymous = document.getElementById('anonymous').value === 'yes'; // true/false
    const sendInbox = document.getElementById('send-inbox').checked;
    const sendEmail = document.getElementById('send-email').checked;
    const sendSms = document.getElementById('send-sms').checked;

    // 3. Validate dữ liệu
    if (!receiver) {
        showNotification('Lỗi', 'Vui lòng nhập thông tin người nhận!', 'error');
        return;
    }
    if (!title || !content) {
        showNotification('Lỗi', 'Vui lòng nhập tiêu đề và nội dung!', 'error');
        return;
    }
    if (!sendInbox && !sendEmail && !sendSms) {
        showNotification('Lỗi', 'Vui lòng chọn ít nhất một kênh gửi!', 'error');
        return;
    }

    // Hiển thị trạng thái đang gửi
    const sendBtn = document.querySelector('#preview-section .btn'); // Nút gửi trong preview
    const originalBtnText = sendBtn.innerHTML;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';
    sendBtn.disabled = true;

    try {
        // 4. Lấy session token để xác thực
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Phiên đăng nhập hết hạn');

        // 5. Gọi API gửi tin nhắn
        const response = await fetch('/api/messages/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                receiverIdentifier: receiver,
                receiverMethod: selectedReceiverMethod, // Biến toàn cục từ script.js
                messageType: selectedMessageType,       // Biến toàn cục từ script.js
                title: title,
                content: content,
                isAnonymous: anonymous,
                channels: {
                    inbox: sendInbox,
                    email: sendEmail,
                    sms: sendSms
                }
            })
        });

        const result = await response.json();

        if (result.success) {
            // Thành công!
            showNotification('Thành công', result.message, 'success');

            // Nếu có Match, có thể hiển thị thêm hiệu ứng (Tùy chọn)
            if (result.isMatch) {
                alert("💘 CHÚC MỪNG! Bạn và người ấy đã kết nối thành công!");
            }

            // Reset Form
            document.getElementById('receiver-input').value = '';
            document.getElementById('message-title').value = '';
            document.getElementById('message-content').value = '';
            closePreview();
        } else {
            // Lỗi từ server trả về (ví dụ: Không tìm thấy người nhận)
            showNotification('Lỗi', result.message, 'error');
        }

    } catch (error) {
        console.error('Lỗi gửi tin:', error);
        showNotification('Lỗi', 'Lỗi kết nối đến server', 'error');
    } finally {
        // Khôi phục nút bấm
        sendBtn.innerHTML = originalBtnText;
        sendBtn.disabled = false;
    }
}

async function loadInbox() {
    const container = document.getElementById('inbox-container');

    if (!currentUser) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i class="fas fa-envelope-open"></i></div>
                <h3>Vui lòng đăng nhập</h3>
                <p>Đăng nhập để xem tin nhắn của bạn.</p>
            </div>`;
        return;
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Chưa đăng nhập');

        const response = await fetch(`/api/messages/inbox`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });

        const data = await response.json();

        if (data.success) {
            if (data.messages && data.messages.length > 0) {
                let messagesHTML = '';
                data.messages.forEach(msg => {
                    const messageType = {
                        'share': 'Lời tâm sự',
                        'confess': 'Bày tỏ tình cảm',
                        'reconnect': 'Muốn quay lại'
                    }[msg.messageType] || 'Tin nhắn';

                    const senderUsername = msg.sender?.username !== 'anonymous' ? msg.sender?.username : '';

                    messagesHTML += `
                        <div class="message-item" id="msg-${msg.id}">
                            <div class="message-header">
                                <div class="message-sender">
                                    <i class="fas fa-user"></i>
                                    ${escapeHTML(msg.sender.fullname)}
                                </div>
                                <div class="message-time">
                                    <i class="fas fa-clock"></i>
                                    ${new Date(msg.createdAt).toLocaleString('vi-VN')}
                                </div>
                            </div>
                            <div class="message-type-badge">${messageType}</div>
                            <div class="message-title">${escapeHTML(msg.title)}</div>
                            <div class="message-content" style="white-space: pre-line;">${escapeHTML(msg.content)}</div>
                            
                            <div class="message-actions" style="margin-top: 15px; display: flex; gap: 10px;">
                                ${!msg.isAnonymous ? `
                                <button class="action-btn reply-btn" onclick="replyMessage('${senderUsername}')">
                                    <i class="fas fa-reply"></i> Trả lời
                                </button>` : ''}
                                
                                <button class="action-btn delete-btn" onclick="deleteMessage('${msg.id}')">
                                    <i class="fas fa-trash"></i> Xóa
                                </button>
                            </div>
                        </div>
                    `;
                });

                container.innerHTML = messagesHTML;
                updateInboxCount(data.messages.length);
            } else {
                // Giữ nguyên giao diện empty state cũ
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon"><i class="fas fa-envelope-open"></i></div>
                        <h3>Hộp thư trống</h3>
                        <p>Bạn chưa có tin nhắn nào.</p>
                    </div>`;
                updateInboxCount(0);
            }
        }
    } catch (error) {
        console.error('Load inbox error:', error);
        container.innerHTML = '<p class="error">Lỗi tải dữ liệu.</p>';
    }
}

// [SỬA] Hàm tải hộp thư đi (Đã thêm nút Xóa)
async function loadSentMessages() {
    const container = document.getElementById('sent-container');
    if (!currentUser) return;

    try {
        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(`/api/messages/sent`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });

        const data = await response.json();

        if (data.success && data.messages.length > 0) {
            let html = '';
            data.messages.forEach(msg => {
                const typeName = {
                    'share': 'Lời tâm sự',
                    'confess': 'Bày tỏ',
                    'reconnect': 'Quay lại'
                }[msg.message_type] || 'Tin nhắn';

                const receiverInfo = msg.receiver_identifier || 'Không rõ';
                const method = msg.receiver_method || '';

                // [THAY ĐỔI]: Thêm ID cho thẻ div và thêm nút Xóa ở dưới cùng
                html += `
                    <div class="message-item" id="sent-msg-${msg.id}" style="border-left-color: #4dabf7;">
                        <div class="message-header">
                            <span style="color: #4dabf7; font-weight: bold;">
                                <i class="fas fa-arrow-right"></i> Gửi tới: ${escapeHTML(receiverInfo)}
                                <small style="color: #999; font-weight: normal;">(${method})</small>
                            </span>
                            <span style="font-size: 0.8rem; color: #888;">
                                ${new Date(msg.created_at).toLocaleString('vi-VN')}
                            </span>
                        </div>
                        <div class="message-type-badge" style="background: #e7f5ff; color: #4dabf7; display:inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.8em; margin: 5px 0;">
                            ${typeName}
                        </div>
                        <div class="message-title" style="font-weight: bold;">${escapeHTML(msg.title)}</div>
                        <div class="message-content" style="margin-top: 5px; white-space: pre-wrap; color: #666;">${escapeHTML(msg.content)}</div>
                        
                        <div style="margin-top: 10px; font-size: 0.85rem; color: #aaa; font-style: italic; display: flex; justify-content: space-between; align-items: center;">
                            <span>${msg.is_anonymous ? '<i class="fas fa-user-secret"></i> Bạn đã gửi ẩn danh' : '<i class="fas fa-user"></i> Gửi công khai'}</span>
                            
                            <button class="action-btn delete-btn" onclick="deleteSentMessage('${msg.id}')" style="padding: 5px 10px; font-size: 0.8rem;">
                                <i class="fas fa-trash"></i> Xóa
                            </button>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i class="fas fa-paper-plane"></i></div>
                    <h3>Chưa gửi tin nào</h3>
                    <p>Hãy bắt đầu gửi những lời yêu thương ngay!</p>
                </div>`;
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = 'Lỗi tải tin nhắn đã gửi.';
    }
}

async function deleteMessage(messageId) {
    if (!confirm('Bạn có chắc chắn muốn xóa tin nhắn này không?')) return;

    try {
        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(`/api/messages/${messageId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.access_token}` }
        });

        const data = await response.json();

        if (data.success) {
            // Xóa hiệu ứng trên giao diện ngay lập tức
            const msgElement = document.getElementById(`msg-${messageId}`);
            if (msgElement) {
                msgElement.style.opacity = '0';
                setTimeout(() => msgElement.remove(), 300);

                // Cập nhật lại số lượng tin nhắn (giảm đi 1)
                const badge = document.getElementById('inbox-count');
                let currentCount = parseInt(badge.textContent) || 0;
                updateInboxCount(Math.max(0, currentCount - 1));
            }
            showNotification('Thành công', 'Đã xóa tin nhắn', 'success');
        } else {
            showNotification('Lỗi', data.message || 'Không thể xóa', 'error');
        }
    } catch (error) {
        console.error('Lỗi xóa:', error);
        showNotification('Lỗi', 'Lỗi kết nối server', 'error');
    }
}

// [THÊM MỚI] Hàm trả lời tin nhắn (Chuyển sang tab Gửi và điền sẵn username)
function replyMessage(username) {
    if (!username) {
        showNotification('Thông báo', 'Người gửi ẩn danh hoặc không xác định, không thể trả lời trực tiếp.', 'info');
        return;
    }

    // Chuyển sang tab gửi tin nhắn
    document.querySelector('.tab[data-tab="send"]').click();

    // Chọn phương thức gửi là Username
    const usernameMethodBtn = document.querySelector('.receiver-method[data-method="username"]');
    if (usernameMethodBtn) usernameMethodBtn.click();

    // Điền username vào ô nhập
    const input = document.getElementById('receiver-input');
    input.value = username;

    // Focus vào ô tiêu đề để người dùng nhập tiếp
    document.getElementById('message-title').focus();

    showNotification('Thông tin', `Đang trả lời tin nhắn của ${username}`, 'info');
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

// --- [THÊM MỚI] CHỨC NĂNG TRỢ GIÚP (POPUP) ---
const helpData = {
    'faq': {
        title: '<i class="fas fa-question-circle"></i> Câu hỏi thường gặp',
        content: `
            <h3 style="color: #ff4d94; border-bottom: 1px solid #ddd; padding-bottom: 5px;">FAQ – CÂU HỎI THƯỜNG GẶP VỀ HEARTCONNECT</h3>
            <p>Dưới đây là những câu hỏi phổ biến giúp bạn hiểu rõ hơn cách HeartConnect hoạt động, cũng như cách chúng tôi bảo vệ quyền riêng tư và cảm xúc của người dùng.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;">
            <p><strong>1. HeartConnect là gì?</strong><br>HeartConnect là nền tảng kết nối cảm xúc riêng tư, cho phép người dùng bày tỏ những điều khó nói một cách tinh tế. Hệ thống chỉ xác nhận kết nối khi cả hai phía cùng đồng ý, giúp giảm áp lực và tránh tổn thương cảm xúc một chiều.</p>
            <p><strong>2. Người nhận có biết tôi đã gửi tín hiệu không?</strong><br>Không.<br>Khi bạn gửi tín hiệu cảm xúc, hệ thống không gửi thông báo và người nhận hoàn toàn không biết về tín hiệu đó. Chỉ khi người kia cũng gửi tín hiệu phù hợp và hệ thống phát hiện trùng khớp (Match), cả hai mới được thông báo.</p>
            <p><strong>3. Nếu không có Match thì sao?</strong><br>Nếu không có Match:- Không có bất kỳ thông báo nào được gửi đi - Không có thông tin nào bị tiết lộ - Không để lại dấu vết cảm xúc một chiều.<br>Điều này giúp bạn bày tỏ cảm xúc mà không phải đối mặt với việc bị từ chối trực tiếp.</p>
            <p><strong>4. Dữ liệu của tôi có an toàn không?</strong><br>Có. Quyền riêng tư và an toàn dữ liệu là ưu tiên hàng đầu của HeartConnect.<br>• Mỗi người dùng chỉ truy cập được dữ liệu của chính mình<br>• Thông tin không hiển thị công khai<br>• Dữ liệu được bảo vệ bằng các biện pháp kỹ thuật và phân quyền truy cập<br>Hiểu đơn giản: chỉ khi có sự đồng thuận từ cả hai phía thì kết nối mới được mở ra.</p>
            <p><strong>5. HeartConnect có đọc nội dung cảm xúc của tôi không?</strong><br>Không.<br>HeartConnect không khai thác, không phân tích nội dung cảm xúc cho mục đích cá nhân hay thương mại. Dữ liệu chỉ được xử lý ở mức cần thiết để hệ thống hoạt động đúng chức năng kết nối.</p>
            <p><strong>6. Vì sao HeartConnect chỉ dành cho người từ 18 tuổi trở lên?</strong><br>HeartConnect xử lý dữ liệu liên quan đến cảm xúc và mối quan hệ cá nhân.<br>Để đảm bảo môi trường phù hợp, an toàn và tuân thủ quy định về bảo vệ dữ liệu cá nhân, nền tảng chỉ phục vụ người dùng từ đủ 18 tuổi trở lên.</p>
            <p><strong>7. HeartConnect có phải là ứng dụng hẹn hò không?</strong><br>Không.<br>HeartConnect không phải là ứng dụng hẹn hò, không môi giới, không gợi ý ghép cặp. Nền tảng chỉ đóng vai trò trung gian kỹ thuật, giúp xác nhận sự đồng thuận hai chiều khi cả hai cùng bày tỏ cảm xúc.</p>
            <p><strong>8. Tôi có thể xóa dữ liệu hoặc tài khoản của mình không?</strong><br>Có.<br>Bạn có quyền: - Chỉnh sửa thông tin cá nhân - Yêu cầu xóa dữ liệu - Xóa tài khoản và ngừng sử dụng dịch vụ bất cứ lúc nào.<br>Sau khi xóa tài khoản, dữ liệu liên quan sẽ được xử lý theo Chính sách bảo mật hiện hành.</p>
            <p><strong>9. HeartConnect có gửi email làm phiền không?</strong><br>Không.<br>Email chỉ được gửi trong các trường hợp cần thiết như: - Xác thực đăng nhập - Thông báo khi có Match.<br>Chúng tôi không gửi spam và không sử dụng email cho mục đích quảng cáo ngoài ý muốn của người dùng.</p>
            <p><strong>10. Tôi có thể liên hệ HeartConnect bằng cách nào?</strong><br>Nếu bạn có thắc mắc hoặc cần hỗ trợ, vui lòng liên hệ:<br>📧 Email: contact@heartconnect.vn<br>Chúng tôi luôn sẵn sàng lắng nghe và tôn trọng quyền riêng tư của bạn.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;">
            <p style="text-align: center; color: #ff4d94; font-weight: bold;">💗 HeartConnect – Nơi cảm xúc được gửi đi nhẹ nhàng, an toàn và đúng lúc.</p>
        `
    },
    'guide': {
        title: '<i class="fas fa-book"></i> Hướng dẫn sử dụng',
        content: `
            <ol style="margin-left: 20px;">
                <li><strong>Đăng ký/Đăng nhập:</strong> Sử dụng Email thực để nhận thông báo.</li>
                <li><strong>Gửi tin nhắn:</strong>
                    <ul>
                        <li>Chọn loại tin (Tâm sự/Tỏ tình/Quay lại).</li>
                        <li>Nhập Username/Email người nhận.</li>
                        <li>Chọn kênh gửi (Web/Email).</li>
                    </ul>
                </li>
                <li><strong>Kiểm tra hộp thư:</strong> Xem tin nhắn đến ở tab "Hộp thư đến".</li>
            </ol>
        `
    },
    'privacy': {
        title: '<i class="fas fa-user-shield"></i> Chính sách bảo mật',
        content: `
            <h3 style="color: #ff4d94; border-bottom: 1px solid #ddd; padding-bottom: 5px;">CHÍNH SÁCH BẢO MẬT (PRIVACY POLICY)</h3>

            <p>Heart Connect (sau đây gọi là “Chúng tôi”) cam kết tôn trọng và bảo vệ quyền riêng tư của người dùng khi truy cập và sử dụng nền tảng Heart Connect. Chính sách này mô tả cách chúng tôi thu thập, sử dụng, lưu trữ và bảo vệ dữ liệu cá nhân của bạn theo quy định pháp luật Việt Nam, đặc biệt là Nghị định 13/2023/NĐ‑CP về bảo vệ dữ liệu cá nhân.</p>
            
            <p><strong>1. Phạm vi áp dụng</strong><br>Chính sách này áp dụng cho toàn bộ người dùng truy cập, đăng ký và sử dụng website/ứng dụng Heart Connect.<br>Heart Connect chỉ dành cho người từ đủ 18 tuổi trở lên. Chúng tôi không cố ý thu thập hoặc xử lý dữ liệu cá nhân của người dưới 18 tuổi.</p>
            
            <p><strong>2. Dữ liệu cá nhân được thu thập</strong><br>Chúng tôi có thể thu thập và xử lý các loại dữ liệu sau:<br>• Thông tin đăng ký tài khoản: email, sđt, liên kết facebook, ID người dùng, thời điểm tạo tài khoản<br>• Thông tin sử dụng dịch vụ: tín hiệu cảm xúc (signal), trạng thái match, thời gian tương tác<br>Chúng tôi không yêu cầu cung cấp thông tin nhạy cảm như số CMND/CCCD, thông tin tài chính hoặc dữ liệu sinh trắc học.</p>
            
            <p><strong>3. Mục đích xử lý dữ liệu</strong><br>Dữ liệu cá nhân được xử lý nhằm các mục đích sau:<br>• Cung cấp và vận hành chức năng kết nối (matching)<br>• Quản lý tài khoản người dùng<br>• Đảm bảo an toàn hệ thống và ngăn chặn hành vi vi phạm<br>• Cải thiện chất lượng dịch vụ và trải nghiệm người dùng<br>• Thực hiện nghĩa vụ pháp lý theo yêu cầu của cơ quan có thẩm quyền</p>
            
            <p><strong>4. Cơ sở pháp lý cho việc xử lý dữ liệu</strong><br>Chúng tôi xử lý dữ liệu cá nhân dựa trên:<br>• Sự đồng ý rõ ràng của người dùng khi đăng ký và sử dụng dịch vụ<br>• Việc thực hiện hợp đồng cung cấp dịch vụ giữa Heart Connect và người dùng<br>• Nghĩa vụ pháp lý theo quy định của pháp luật Việt Nam<br>Người dùng có quyền rút lại sự đồng ý bất kỳ lúc nào theo quy định tại Mục 7.</p>
            
            <p><strong>5. Lưu trữ và bảo mật dữ liệu</strong><br>• Dữ liệu được lưu trữ trên hạ tầng bên thứ ba đáng tin cậy<br>• Chúng tôi áp dụng các biện pháp kỹ thuật và tổ chức hợp lý để bảo vệ dữ liệu khỏi truy cập trái phép, mất mát hoặc rò rỉ<br>• Thời gian lưu trữ dữ liệu chỉ kéo dài trong phạm vi cần thiết để phục vụ mục đích xử lý hoặc theo yêu cầu pháp luật</p>
            
            <p><strong>6. Chia sẻ dữ liệu với bên thứ ba</strong><br>Chúng tôi không bán hoặc cho thuê dữ liệu cá nhân của người dùng.<br>Dữ liệu có thể được chia sẻ với:<br>• Nhà cung cấp dịch vụ kỹ thuật (ví dụ: dịch vụ lưu trữ, email, phân tích hệ thống)<br>• Cơ quan nhà nước có thẩm quyền khi có yêu cầu hợp pháp<br>Các bên thứ ba này chỉ được phép xử lý dữ liệu theo chỉ đạo của chúng tôi và tuân thủ nghĩa vụ bảo mật.</p>
            
            <p><strong>7. Quyền của người dùng</strong><br>Người dùng có các quyền sau đối với dữ liệu cá nhân của mình:<br>• Quyền được biết về việc xử lý dữ liệu<br>• Quyền truy cập, chỉnh sửa hoặc cập nhật dữ liệu<br>• Quyền yêu cầu xóa dữ liệu hoặc xóa tài khoản<br>• Quyền hạn chế hoặc phản đối việc xử lý dữ liệu<br>• Quyền rút lại sự đồng ý đã cung cấp<br>Mọi yêu cầu liên quan đến dữ liệu cá nhân vui lòng gửi về thông tin liên hệ tại Mục 9.</p>
            
            <p><strong>8. Xóa dữ liệu và chấm dứt tài khoản</strong><br>Khi người dùng yêu cầu xóa tài khoản:<br>• Dữ liệu cá nhân liên quan sẽ được xóa hoặc ẩn danh trong thời gian hợp lý<br>• Một số dữ liệu có thể được giữ lại nếu pháp luật yêu cầu hoặc để giải quyết tranh chấp</p>
            
            <p><strong>9. Thông tin liên hệ</strong><br>Mọi thắc mắc hoặc yêu cầu liên quan đến Chính sách bảo mật, vui lòng liên hệ:<br>• Email: info@heartconnect.vn</p>
            
            <p><strong>10. Thay đổi chính sách</strong><br>Chúng tôi có thể cập nhật Chính sách bảo mật theo thời gian. Mọi thay đổi quan trọng sẽ được thông báo trên nền tảng Heart Connect.<br>Việc tiếp tục sử dụng dịch vụ sau khi chính sách được cập nhật đồng nghĩa với việc bạn chấp nhận nội dung thay đổi.</p>
        `
    },
    'terms': {
        title: '<i class="fas fa-file-contract"></i> Điều khoản dịch vụ',
        content: `
            <h3 style="color: #ff4d94; border-bottom: 1px solid #ddd; padding-bottom: 5px;">ĐIỀU KHOẢN SỬ DỤNG (TERMS OF SERVICE)</h3>

            <p>Chào mừng bạn đến với HeartConnect. Việc bạn truy cập hoặc sử dụng nền tảng này đồng nghĩa với việc bạn đã đọc, hiểu và đồng ý bị ràng buộc bởi các Điều khoản Sử dụng dưới đây.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;">
            
            <p><strong>1. Giới thiệu & phạm vi dịch vụ</strong><br>HeartConnect là một nền tảng hỗ trợ kết nối cảm xúc dựa trên cơ chế đồng thuận hai chiều (mutual match). Nền tảng cho phép người dùng gửi tín hiệu cảm xúc một cách riêng tư và chỉ xác nhận kết nối khi cả hai bên cùng chủ động gửi tín hiệu phù hợp.<br>
            HeartConnect: - Không phải là mạng xã hội - Không hiển thị nội dung công khai - Không cho phép tìm kiếm người dùng tự do - Không cho phép nhắn tin hoặc tương tác trực tiếp trước khi có Match.<br>
            HeartConnect chỉ đóng vai trò là bên cung cấp hạ tầng kỹ thuật, không can thiệp, không định hướng và không chịu trách nhiệm cho các mối quan hệ cá nhân của người dùng.</p>
            
            <p><strong>2. Điều kiện sử dụng</strong><br>Để sử dụng HeartConnect, người dùng phải đáp ứng các điều kiện sau: - Từ đủ 18 tuổi trở lên tại thời điểm đăng ký - Có đầy đủ năng lực hành vi dân sự theo quy định pháp luật - Cung cấp thông tin chính xác khi tạo tài khoản<br>Bằng việc sử dụng dịch vụ, người dùng xác nhận rằng mình đáp ứng đầy đủ các điều kiện nêu trên.</p>
            
            <p><strong>3. Tài khoản & trách nhiệm người dùng</strong><br>• Người dùng chịu trách nhiệm bảo mật thông tin đăng nhập của mình<br>• Mọi hoạt động phát sinh từ tài khoản được xem là do chính người dùng thực hiện<br>• Người dùng cam kết sử dụng HeartConnect một cách tôn trọng, văn minh và tuân thủ pháp luật<br>HeartConnect không chịu trách nhiệm đối với thiệt hại phát sinh từ việc người dùng làm lộ hoặc sử dụng sai thông tin đăng nhập.</p>
            
            <p><strong>4. Cơ chế kết nối & giới hạn trách nhiệm</strong><br>• Khi người dùng gửi tín hiệu cảm xúc, hệ thống chỉ lưu trữ và xử lý dữ liệu một cách tự động, không gửi thông báo một chiều<br>• Người nhận sẽ không biết về tín hiệu nếu chưa có sự trùng khớp<br>• Chỉ khi cả hai bên cùng gửi tín hiệu phù hợp, hệ thống mới xác nhận kết nối (Match) và gửi thông báo cho cả hai bên<br>HeartConnect không đảm bảo rằng việc sử dụng dịch vụ sẽ dẫn đến bất kỳ mối quan hệ hay kết quả cảm xúc cụ thể nào.<br>Mọi tương tác, hành vi hoặc hệ quả phát sinh sau khi có Match nằm ngoài phạm vi kiểm soát và trách nhiệm của HeartConnect.</p>
            
            <p><strong>5. Hành vi bị cấm</strong><br>Người dùng không được phép sử dụng HeartConnect cho các mục đích sau: - Quấy rối, theo dõi, đe dọa hoặc gây áp lực tinh thần đối với người khác - Thu thập, khai thác hoặc sử dụng dữ liệu cá nhân trái phép - Lợi dụng nền tảng cho các hành vi lừa đảo, cưỡng ép hoặc vi phạm pháp luật - Tạo nhiều tài khoản nhằm né tránh giới hạn hoặc biện pháp kiểm soát của hệ thống - Can thiệp, phá hoại hoặc gây ảnh hưởng đến hoạt động ổn định của nền tảng<br>HeartConnect có quyền áp dụng các biện pháp kỹ thuật cần thiết để phát hiện, ngăn chặn và xử lý các hành vi vi phạm.</p>
            
            <p><strong>6. Tạm ngừng & chấm dứt tài khoản</strong><br>HeartConnect có quyền tạm ngừng hoặc chấm dứt quyền truy cập của người dùng nếu phát hiện vi phạm Điều khoản Sử dụng này hoặc quy định pháp luật hiện hành.<br>Người dùng có quyền ngừng sử dụng dịch vụ và yêu cầu xóa tài khoản bất cứ lúc nào thông qua các chức năng được cung cấp trên nền tảng.</p>
            
            <p><strong>7. Giới hạn trách nhiệm</strong><br>HeartConnect được cung cấp trên cơ sở “nguyên trạng”. Trong phạm vi pháp luật cho phép, HeartConnect không chịu trách nhiệm đối với: - Tổn thương cảm xúc phát sinh từ việc kết nối hoặc không kết nối - Tranh chấp cá nhân giữa các người dùng - Thiệt hại phát sinh từ việc sử dụng hoặc không thể sử dụng dịch vụ</p>
            
            <p><strong>8. Thay đổi điều khoản</strong><br>HeartConnect có quyền cập nhật hoặc điều chỉnh Điều khoản Sử dụng này khi cần thiết. Phiên bản cập nhật sẽ được công bố trên nền tảng và có hiệu lực kể từ thời điểm công bố.<br>Việc người dùng tiếp tục sử dụng dịch vụ sau khi Điều khoản được cập nhật đồng nghĩa với việc chấp nhận các thay đổi đó.</p>
            
            <p><strong>9. Luật áp dụng</strong><br>Điều khoản Sử dụng này được điều chỉnh và giải thích theo pháp luật của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam.</p>
            
            <p><strong>10. Liên hệ</strong><br>Mọi thắc mắc liên quan đến Điều khoản Sử dụng, vui lòng liên hệ:<br>Email: contact@heartconnect.io.vn</p>
        `
    },
    'contact': {
        title: '<i class="fas fa-headset"></i> Hỗ trợ trực tuyến',
        content: `
            <p>Đội ngũ hỗ trợ làm việc từ 8:00 - 22:00 hàng ngày.</p>
            <p><strong>Hotline:</strong> 1900 1234</p>
            <p><strong>Zalo:</strong> 0987 654 321</p>
            <p><strong>Email:</strong> support@heartconnect.io.vn</p>
            <p style="margin-top: 10px; font-style: italic;">Vui lòng chờ phản hồi trong vòng 24h.</p>
        `
    }
};

// Hàm hiển thị Popup Trợ giúp
function showHelp(type) {
    const data = helpData[type];
    if (!data) return;

    // Điền dữ liệu vào Popup
    document.getElementById('help-title').innerHTML = data.title;
    document.getElementById('help-content').innerHTML = data.content;

    // Hiển thị Popup và lớp phủ mờ
    document.getElementById('help-overlay').style.display = 'block';
    document.getElementById('help-popup').style.display = 'block';
}

// Hàm đóng Popup Trợ giúp
function closeHelp() {
    document.getElementById('help-overlay').style.display = 'none';
    document.getElementById('help-popup').style.display = 'none';
}

// Hàm gửi Góp ý (Giả lập)
function sendFeedback() {
    const email = document.getElementById('feedback-email').value.trim();
    const content = document.getElementById('feedback-content').value.trim();

    if (!content) {
        showNotification('Lỗi', 'Vui lòng nhập nội dung góp ý!', 'error');
        return;
    }

    // Gọi API Feedback (Backend đã có sẵn API này)
    fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || 'anonymous', content })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showNotification('Cảm ơn', 'Góp ý của bạn đã được ghi nhận!', 'success');
                document.getElementById('feedback-content').value = '';
            } else {
                showNotification('Lỗi', 'Không thể gửi góp ý lúc này.', 'error');
            }
        })
        .catch(() => {
            showNotification('Lỗi', 'Lỗi kết nối server.', 'error');
        });
}

// Đưa TẤT CẢ các hàm cần gọi từ HTML ra phạm vi window
window.switchAuthTab = switchAuthTab;
window.login = login;
window.register = register;
window.logout = logout;
window.selectResetMethod = selectResetMethod;
window.resetPassword = resetPassword;
window.submitNewPassword = submitNewPassword;
window.cancelPasswordReset = cancelPasswordReset;

window.selectMessageType = selectMessageType;
window.selectReceiverMethod = selectReceiverMethod;
window.previewMessage = previewMessage;
window.closePreview = closePreview;
window.sendMessage = sendMessage;

window.deleteMessage = deleteMessage;
window.replyMessage = replyMessage;

window.showEditProfile = showEditProfile;
window.cancelEditProfile = cancelEditProfile;
window.updateProfile = updateProfile;

window.showHelp = showHelp;
window.closeHelp = closeHelp;
window.sendFeedback = sendFeedback;

window.loadSentMessages = loadSentMessages;
window.deleteSentMessage = deleteSentMessage;

// [THÊM MỚI] Hàm xóa tin nhắn đã gửi
async function deleteSentMessage(messageId) {
    if (!confirm('Bạn có chắc muốn xóa tin nhắn đã gửi này không? Hành động này không thể hoàn tác.')) return;

    try {
        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(`/ api / messages / ${messageId} `, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.access_token} ` }
        });

        const data = await response.json();

        if (data.success) {
            // Xóa hiệu ứng trên giao diện (tìm theo ID đã đặt ở bước trên)
            const msgElement = document.getElementById(`sent - msg - ${messageId} `);
            if (msgElement) {
                msgElement.style.opacity = '0';
                setTimeout(() => msgElement.remove(), 300);
            }
            showNotification('Thành công', 'Đã xóa tin nhắn', 'success');

            // Nếu xóa hết thì hiện lại empty state (tùy chọn)
            const container = document.getElementById('sent-container');
            if (container.children.length <= 1) { // 1 vì phần tử đang xóa chưa kịp mất hẳn trong DOM
                // Có thể gọi lại loadSentMessages() nếu muốn reset giao diện chuẩn
            }
        } else {
            showNotification('Lỗi', data.message || 'Không thể xóa', 'error');
        }
    } catch (error) {
        console.error('Lỗi xóa:', error);
        showNotification('Lỗi', 'Lỗi kết nối server', 'error');
    }
}

initApp();

// [THÊM] Hiệu ứng trái tim bay nền
function createFloatingHearts() {
    const container = document.getElementById('bg-animation');
    if (!container) return;

    const heartSymbols = ['❤', '💖', '💕', '💗', '💓'];
    const heartCount = 15; // Số lượng trái tim cùng lúc

    setInterval(() => {
        if (container.children.length > heartCount) {
            container.removeChild(container.firstChild);
        }

        const heart = document.createElement('div');
        heart.classList.add('floating-heart');
        heart.innerText = heartSymbols[Math.floor(Math.random() * heartSymbols.length)];

        // Vị trí ngẫu nhiên
        heart.style.left = Math.random() * 100 + 'vw';
        // Kích thước ngẫu nhiên
        heart.style.fontSize = (Math.random() * 20 + 10) + 'px';
        // Thời gian bay ngẫu nhiên
        heart.style.animationDuration = (Math.random() * 5 + 5) + 's';

        container.appendChild(heart);
    }, 800); // Cứ 0.8s tạo 1 trái tim
}

createFloatingHearts();