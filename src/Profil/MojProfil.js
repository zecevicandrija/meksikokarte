// MyProfile.js
import React, { useState, useEffect } from 'react';
import '../Styles/MojProfil.css';

const MojProfil = () => {
    const [avatarHover, setAvatarHover] = useState(false);
    const [showOverlay, setShowOverlay] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 200) setShowOverlay(true);
            else setShowOverlay(false);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="profile-container">
            <div className="profile-header">
                <div 
                    className="avatar" 
                    onMouseEnter={() => setAvatarHover(true)} 
                    onMouseLeave={() => setAvatarHover(false)} 
                >
                    <img src="https://picsum.photos/300" alt="User" />
                    <div className={`avatar-overlay ${avatarHover ? 'hovered' : ''}`}>
                        <span className="add-icon">+</span>
                    </div>
                </div>
                <div className="profile-info">
                    <h1 className="username">CardMaster42</h1>
                    <p className="rank">Rank: Legendary Collector</p>
                    <div className="stats">
                        <div className="stat">
                            <span className="label">Wins</span>
                            <span className="value">452</span>
                        </div>
                        <div className="stat">
                            <span className="label">Draws</span>
                            <span className="value">38</span>
                        </div>
                        <div className="stat">
                            <span className="label">Losses</span>
                            <span className="value">97</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="badges-section">
                <h2 className="section-title">Achievements</h2>
                <div className="badges-grid">
                    <div className="badge">
                        <i className="fas fa-trophy gold"></i>
                        <p>Champion Trophy</p>
                    </div>
                    <div className="badge">
                        <i className="fas fa-gem diamond"></i>
                        <p>Diamond Collector</p>
                    </div>
                    <div className="badge">
                        <i className="fas fa-fire red"></i>
                        <p>Hot Streak</p>
                    </div>
                    <div className="badge">
                        <i className="fas fa-shield-alt blue"></i>
                        <p>Perfect Defense</p>
                    </div>
                </div>
            </div>

            <div className={`games-history ${showOverlay ? 'overlay' : ''}`}>
                <h2 className="section-title">Game History</h2>
                <div className="games-grid">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="game-card">
                            <div className="card-content">
                                <h3 className="game-title">Duel of Legends</h3>
                                <p className="game-date">Yesterday</p>
                                <p className="game-result win">Victory!</p>
                            </div>
                            <div className="card-meta">
                                <span>Deck: <strong>ControlWarrior</strong></span>
                                <span>Opponent: <strong>RaccoonMage</strong></span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MojProfil;