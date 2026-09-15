/* فایل موقت برای بازبینی چشمی ناوبری داشبورد — بعد از تأیید حذف می‌شود */
import { createRoot } from 'react-dom/client';
import DashboardLayout from './layout/dashboard/DashboardLayout';
import './styles.css';

const USER = {
  id: '9608da84-567e-4cbb-9702-13678dc5389b',
  phone: '3148',
  profile: {
    firstName: 'امیرحسین',
    lastName: 'حیدریان',
    username: 'heidar1an',
    university: 'دانشگاه علوم پزشکی ایران',
    term: '۲',
    avatar: '',
  },
};

window.localStorage.setItem('tapesh:current-user', JSON.stringify(USER));

createRoot(document.getElementById('root')).render(
  <DashboardLayout userData={USER} onUserDataChange={() => {}} onLogout={() => {}} />,
);
