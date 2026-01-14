 
import { createRoot } from 'react-dom/client';

import Header from './components/Header';
import ProfileTester from './components/ProfileTester';

import './main.css';

const App = () => {
    return (
        <div className='w-screen h-screen bg-[#2c2c2c] text-white font-bold p-10'>
            <div className="w-full h-full overflow-hidden bg-[#262626] shadow-md rounded-xl">
                <Header />
                
                {/* CONTENT */}
                <div className='flex'>
                    {/* EDITOR */}
                    <div>
                        <ProfileTester />
                    </div>

                    {/* SIDEBAR */}
                    <div>

                    </div>
                </div>

            </div>
        </div>
    );
};

createRoot(document.getElementById('root')!).render(
    // <StrictMode>
        <App />
    // </StrictMode>
);