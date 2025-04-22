import { Link, useLocation } from 'wouter';

export default function MobileNavigation() {
  const [location] = useLocation();
  
  return (
    <div className="md:hidden bg-white dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 fixed bottom-0 inset-x-0 z-10">
      <div className="flex justify-around">
        <Link href="/">
          <a className={`flex flex-col items-center p-3 ${
            location === '/' 
              ? 'text-primary dark:text-primary-light' 
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span className="text-xs mt-1">Home</span>
          </a>
        </Link>
        
        <Link href="/search">
          <a className={`flex flex-col items-center p-3 ${
            location === '/search' 
              ? 'text-primary dark:text-primary-light' 
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <span className="text-xs mt-1">Search</span>
          </a>
        </Link>
        
        <Link href="/messages">
          <a className={`flex flex-col items-center p-3 ${
            location === '/messages' 
              ? 'text-primary dark:text-primary-light' 
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            <span className="text-xs mt-1">Messages</span>
          </a>
        </Link>
        
        <Link href="/profile">
          <a className={`flex flex-col items-center p-3 ${
            location === '/profile' 
              ? 'text-primary dark:text-primary-light' 
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span className="text-xs mt-1">Profile</span>
          </a>
        </Link>
      </div>
    </div>
  );
}
