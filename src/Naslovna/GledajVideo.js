import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Login/AuthContext';
import axios from 'axios';
import glovo from '../Slike/nigrutinglovo.mp4';
import '../Styles/GledajVideo.css';

const GledajVideo = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showCloseButton, setShowCloseButton] = useState(false);
  const [isAddingTokens, setIsAddingTokens] = useState(false);

  const addTokens = async () => {
    setIsAddingTokens(true);
    try {
      await axios.post('http://localhost:5000/api/tokeni/dodaj', {
        userId: user.id,
        kolicina: 200
      });
      setIsAddingTokens(false);
    } catch (error) {
      console.error('Greška prilikom dodavanja tokena:', error);
      setIsAddingTokens(false);
    }
  };

  const handleVideoEnd = async () => {
    await addTokens();
    setShowCloseButton(true);
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  return (
    <div className="gledaj-video-container">
      {user ? (
        <>
          <video
            className="video-player"
            src={glovo}
            autoPlay
            playsInline
            onEnded={handleVideoEnd}
            loop={false}
            controls={false}
          />
          {showCloseButton && (
            <button className="close-btn" onClick={() => navigate('/pocetna')}>
              X
            </button>
          )}
          {isAddingTokens && (
            <div className="loading">Dodavanje tokena...</div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default GledajVideo;