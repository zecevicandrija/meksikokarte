import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../Login/AuthContext';

const DodavanjeTokena = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [kolicina, setKolicina] = useState(100);
  const { user } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/korisnici/svikorisnici');
        setUsers(response.data);
      } catch (error) {
        console.error('Greskа pri ucitavanju korisnika:', error);
      }
    };
    
    if (user?.uloga === 'admin') fetchUsers();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/tokeni/dodaj', {
        userId: selectedUser,
        kolicina: parseInt(kolicina)
      });
      alert('Tokeni uspesno dodati!');
    } catch (error) {
      console.error('Greska:', error.response?.data || error.message);
    }
  };

  if (user?.uloga !== 'admin') {
    return <div>Ne moze</div>;
  }

  return (
    <div className="admin-container">
      <h2>Dodavanje tokena</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Korisnik:</label>
          <select 
            value={selectedUser} 
            onChange={(e) => setSelectedUser(e.target.value)}
            required
          >
            <option value="">Izaberite korisnika</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.ime} {user.prezime} ({user.email})
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label>Kolicina:</label>
          <input
            type="number"
            value={kolicina}
            onChange={(e) => setKolicina(e.target.value)}
            min="1"
            required
          />
        </div>
        
        <button type="submit">Dodaj Tokene</button>
      </form>
    </div>
  );
};

export default DodavanjeTokena;