// import React, { useState, useEffect } from "react";
// import "../Styles/Bacanje.css"; // Klasičan CSS za stilizaciju
// import axios from "axios";

// const Bacanje = ({ socket, user, roundId, hand, setHand }) => {
//   const [playedCards, setPlayedCards] = useState([]); // Karte koje su bačene na sto
//   const [currentPlayerId, setCurrentPlayerId] = useState(null); // Trenutni igrač
//   const [isMyTurn, setIsMyTurn] = useState(false); // Da li je potez trenutnog igrača
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     // Dohvatanje trenutnog reda bacanja sa servera
//     const fetchPlayedCards = async () => {
//       try {
//         const response = await axios.get(`http://localhost:5000/api/bacanje/${roundId}`);
//         setPlayedCards(response.data || []); // Fallback na prazan niz
//       } catch (err) {
//         console.error("Greška pri dohvatanju bacenih karata:", err);
//         setPlayedCards([]); // Fallback na prazan niz u slučaju greške
//       }
//     };

//     fetchPlayedCards();

//     // Socket listener za ažuriranje bacanja
//     socket.on("cardPlayed", (newPlay) => {
//       console.log("Primljen događaj cardPlayed:", newPlay);
//       if (!newPlay.nextPlayerId) {
//         console.error("nextPlayerId nije definisan!");
//         return;
//       }
//       setPlayedCards((prev) => [...prev, newPlay]);
//       setCurrentPlayerId(newPlay.nextPlayerId);
//     });

//     // Cleanup
//     return () => {
//       socket.off("cardPlayed");
//     };
//   }, [roundId, socket]);

//   useEffect(() => {
//     // Provera da li je trenutni igrač na potezu
//     if (!user || !user.id) {
//       console.error("User nije definisan ili nema ID!");
//       return;
//     }

//     if (!currentPlayerId) {
//       console.warn("Current player ID nije definisan!");
//       setIsMyTurn(false);
//       return;
//     }

//     setIsMyTurn(user.id === currentPlayerId);
//   }, [currentPlayerId, user]);

//   const handleCardPlay = async (card) => {
//     if (!isMyTurn) {
//       alert("Nije vaš red za igranje!");
//       return;
//     }

//     setLoading(true);

//     try {
//       // API poziv za bacanje karte
//       await axios.post(`http://localhost:5000/api/bacanje/${roundId}`, {
//         playerId: user.id,
//         cardValue: card.value,
//         cardSuit: card.suit,
//       });

//       // Ažuriranje lokalnog stanja ruke i bacenih karata
//       setHand((prevHand) => prevHand.filter((c) => c.value !== card.value || c.suit !== card.suit));
//       socket.emit("cardPlayed", {
//         roundId,
//         playerId: user.id,
//         cardValue: card.value,
//         cardSuit: card.suit,
//       });

//       setLoading(false);
//     } catch (err) {
//       console.error("Greška pri bacanju karte:", err);
//       alert("Došlo je do greške pri bacanju karte.");
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="bacanje-container">
//       <h2>Bacanje karata</h2>
//       <div className="played-cards">
//         {playedCards.map((card, index) => (
//           <div key={index} className="card">
//             <img src={card.image} alt={`${card.value} ${card.suit}`} />
//           </div>
//         ))}
//       </div>
//       <div className="your-hand">
//         <h3>Vaša ruka:</h3>
//         <div className="hand-cards">
//           {hand.map((card, index) => (
//             <div
//               key={index}
//               className={`card ${isMyTurn ? "clickable" : ""}`}
//               onClick={() => isMyTurn && handleCardPlay(card)}
//             >
//               <img src={card.image} alt={`${card.value} ${card.suit}`} />
//             </div>
//           ))}
//         </div>
//       </div>
//       {loading && <p>Izvršava se...</p>}
//       {!isMyTurn && <p>Čekajte svoj red...</p>}
//     </div>
//   );
// };

// export default Bacanje;
