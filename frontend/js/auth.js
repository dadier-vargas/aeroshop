/**
 * Gestor de Autenticación del Cliente (AeroShop)
 */
const Auth = {
  setSession(token, user) {
    localStorage.setItem('aero_token', token);
    localStorage.setItem('aero_user', JSON.stringify(user));
    window.dispatchEvent(new Event('authChange'));
  },

  logout() {
    localStorage.removeItem('aero_token');
    localStorage.removeItem('aero_user');
    window.dispatchEvent(new Event('authChange'));
  },

  isAuthenticated() {
    const token = localStorage.getItem('aero_token');
    if (!token) return false;
    return this.isTokenValid(token);
  },

  getTokenExpiry(token) {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.exp ? payload.exp * 1000 : null;
    } catch (_) {
      return null;
    }
  },

  isTokenValid(token) {
    if (!token) return false;
    if (token.startsWith('mock-jwt-token-')) return true;
    const exp = this.getTokenExpiry(token);
    if (!exp) return true;
    if (Date.now() >= exp) {
      this.logout();
      return false;
    }
    return true;
  },

  getToken() {
    const token = localStorage.getItem('aero_token');
    if (!this.isTokenValid(token)) return null;
    return token;
  },

  getUser() {
    if (!this.isAuthenticated()) return null;
    const userStr = localStorage.getItem('aero_user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch (e) {
      this.logout();
      return null;
    }
  },

  isAdmin() {
    const user = this.getUser();
    return user && user.role === 'admin';
  },

  checkSessionOnLoad() {
    const token = localStorage.getItem('aero_token');
    if (token && !this.isTokenValid(token)) {
      window.dispatchEvent(new Event('authChange'));
      return false;
    }
    return !!token;
  }
};