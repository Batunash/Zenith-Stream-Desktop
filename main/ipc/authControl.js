const { ipcMain } = require('electron');
const bcrypt = require('bcryptjs');
const db = require('../../backend/src/config/database');
module.exports = function registerAuthControl() {
  ipcMain.handle('auth:register', async (event, { username, password }) => {
    try {
      const existingUser = db.getUserByUsername(username);
      if (existingUser) {
        return { success: false, message: 'Bu kullanıcı adı zaten alınmış.' };
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      db.createUser(username, hashedPassword);

      return { success: true, message: 'Kayıt başarılı! Giriş yapabilirsiniz.' };
    } catch (err) {
      console.error('Kayıt Hatası:', err);
      return { success: false, message: 'Kayıt sırasında hata oluştu.' };
    }
  });
  ipcMain.handle('auth:login', async (event, { username, password }) => {
    try {
      const user = db.getUserByUsername(username);
      if (!user) {
        return { success: false, message: 'Kullanıcı bulunamadı.' };
      }
      const isMatch = await bcrypt.compare(password, user.PASSWORD);

      if (isMatch) {
        return {
          success: true,
          user: { id: user.ID, username: user.USERNAME },
        };
      } else {
        return { success: false, message: 'Hatalı şifre.' };
      }
    } catch (err) {
      console.error('Giriş Hatası:', err);
      return { success: false, message: 'Giriş işlemi başarısız.' };
    }
  });
};
