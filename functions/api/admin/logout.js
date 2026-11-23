// Dashboard logout: clears the session cookie.
import { logout } from '../../../lib/admin.js';
export const onRequestPost = () => logout();
