import React, { useState, useEffect } from 'react';
import '../Styles/Friends.css';
import { useAuth } from '../Login/AuthContext';

const Friends = () => {
  const { user } = useAuth();
  const [friendRequests, setFriendRequests] = useState([]);
  const [friendList, setFriendList] = useState([]);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [friendRequestInput, setFriendRequestInput] = useState('');

  // Novo: stanje za modal za uklanjanje prijatelja
  const [selectedFriendToRemove, setSelectedFriendToRemove] = useState(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  // Funkcija za dohvat friend request-a
  const fetchFriendRequests = () => {
    if (user && user.id) {
      fetch(`http://localhost:5000/api/friends/requests/${user.id}`)
        .then(res => res.json())
        .then(data => setFriendRequests(data))
        .catch(err => console.error("Greška pri dohvatanju friend request-a:", err));
    }
  };

  // Funkcija za dohvat liste prijatelja
  const fetchFriendList = () => {
    if (user && user.id) {
      fetch(`http://localhost:5000/api/friends/${user.id}`)
        .then(res => res.json())
        .then(data => setFriendList(data))
        .catch(err => console.error("Greška pri dohvatanju liste prijatelja:", err));
    }
  };

  // Polling friend request-a svakih 5 sekundi
  useEffect(() => {
    fetchFriendRequests(); // Inicijalni poziv
    const friendRequestInterval = setInterval(fetchFriendRequests, 5000);
    return () => clearInterval(friendRequestInterval);
  }, [user]);

  // Polling liste prijatelja svakih 5 sekundi
  useEffect(() => {
    fetchFriendList(); // Inicijalni poziv
    const friendListInterval = setInterval(fetchFriendList, 5000);
    return () => clearInterval(friendListInterval);
  }, [user]);

  const sendFriendRequest = () => {
    if (!user) {
      console.error("Korisnik nije definisan");
      return;
    }
    fetch('http://localhost:5000/api/friends/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: user.id,
        receiverId: friendRequestInput
      })
    })
      .then(res => res.json())
      .then(data => {
        console.log('Friend request poslat:', data);
        // Nakon slanja, osveži friend requests odmah
        fetchFriendRequests();
      })
      .catch(err => console.error("Greška pri slanju friend request-a:", err));
  };

  const acceptFriendRequest = (requestId) => {
    fetch('http://localhost:5000/api/friends/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, action: 'accepted' })
    })
      .then(res => res.json())
      .then(data => {
        console.log('Friend request prihvaćen:', data);
        setFriendRequests(prev => prev.filter(req => req.id !== requestId));
        fetchFriendList();
      })
      .catch(err => console.error("Greška pri prihvatanju friend request-a:", err));
  };

  const rejectFriendRequest = (requestId) => {
    fetch('http://localhost:5000/api/friends/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, action: 'rejected' })
    })
      .then(res => res.json())
      .then(data => {
        console.log('Friend request odbijen:', data);
        setFriendRequests(prev => prev.filter(req => req.id !== requestId));
      })
      .catch(err => console.error("Greška pri odbijanju friend request-a:", err));
  };

  // Funkcija za uklanjanje prijatelja
  const removeFriend = () => {
    if (!user || !selectedFriendToRemove) return;
    fetch('http://localhost:5000/api/friends/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        friendId: selectedFriendToRemove.id
      })
    })
      .then(res => res.json())
      .then(data => {
        console.log('Friend removed:', data);
        // Ažuriraj lokalnu listu tako što ćeš izbaciti uklonjenog prijatelja
        setFriendList(prev => prev.filter(f => f.id !== selectedFriendToRemove.id));
        setShowRemoveModal(false);
        setSelectedFriendToRemove(null);
      })
      .catch(err => console.error("Greška pri uklanjanju prijatelja:", err));
  };

  return (
    <div className="friends-container">
      <div className="friends-controls">
        <button className="friend-btn" onClick={() => setShowRequestsModal(true)}>
          <i className="fa-solid fa-envelope"></i>
        </button>
        <button className="friend-btn" onClick={() => setShowFriendsModal(true)}>
          Prijatelji
        </button>
      </div>

      {/* Modal za friend request notifikacije */}
      {showRequestsModal && (
        <div className="modal-overlay" onClick={() => setShowRequestsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Friend Requests</h3>
            {friendRequests.length > 0 ? (
              friendRequests.map(req => (
                <div key={req.id} className="friend-request">
                  <span>{req.senderIme} {req.senderPrezime}</span>
                  <div className="request-actions">
                    <button onClick={() => acceptFriendRequest(req.id)} className="accept-btn">✓</button>
                    <button onClick={() => rejectFriendRequest(req.id)} className="reject-btn">X</button>
                  </div>
                </div>
              ))
            ) : (
              <p>Nema notifikacija</p>
            )}
          </div>
        </div>
      )}

      {/* Modal za listu prijatelja */}
      {showFriendsModal && (
        <div className="modal-overlay" onClick={() => setShowFriendsModal(false)}>
          <div className="modal friends-modal" onClick={e => e.stopPropagation()}>
            <h3>Moji Prijatelji</h3>
            {friendList.length > 0 ? (
              friendList.map(friend => (
                <div key={friend.id} className="friend-item">
                  <span className="friend-name">{friend.ime} {friend.prezime}</span>
                  <span className={`status ${friend.online ? 'online' : 'offline'}`}>
                    {friend.online ? 'Online' : 'Offline'}
                  </span>
                  <button
                    className="remove-btn"
                    onClick={() => {
                      setSelectedFriendToRemove(friend);
                      setShowRemoveModal(true);
                    }}
                  >
                    Ukloni
                  </button>
                </div>
              ))
            ) : (
              <p>Nema prijatelja</p>
            )}
            <div className="send-request">
              <input
                type="text"
                placeholder="Unesi ID korisnika (piše u ispod imena u profilu)"
                value={friendRequestInput}
                onChange={e => setFriendRequestInput(e.target.value)}
              />
              <button onClick={sendFriendRequest}>Pošalji Friend Request</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal za potvrdu uklanjanja prijatelja */}
      {showRemoveModal && (
        <div className="modal-overlay" onClick={() => setShowRemoveModal(false)}>
          <div className="modal remove-modal" onClick={e => e.stopPropagation()}>
            <h3>Ukloni prijatelja</h3>
            <p>
              Da li sigurno želite da uklonite{' '}
              {selectedFriendToRemove?.ime} {selectedFriendToRemove?.prezime}?
            </p>
            <div className="remove-actions">
              <button className="confirm-btn" onClick={removeFriend}>Da</button>
              <button className="cancel-btn" onClick={() => {
                setShowRemoveModal(false);
                setSelectedFriendToRemove(null);
              }}>Ne</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Friends;
