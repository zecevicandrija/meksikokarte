import React, { useState, useEffect } from "react";
import axios from "axios";
import obicnaprofilna from '../Slike/obicnaprofilna.png';

const PlayerProfile = ({ userId }) => {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/korisnici/${userId}`);
        setProfile(response.data);
      } catch (error) {
        console.error("Greška pri dohvatanju profila:", error);
      }
    };
    
    if (userId) fetchProfile();
  }, [userId]);

  return (
    <div className="player-profile">
      {profile?.profilna ? (
        <img src={profile.profilna} alt="Profilna slika" />
      ) : (
        <img src={obicnaprofilna} alt="Profilna slika" />
      )}
    </div>
  );
};

export default PlayerProfile;