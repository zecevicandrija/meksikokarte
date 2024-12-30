import React from 'react';
import '../Styles/Talon.css';

const Talon = ({ talonCards }) => {
    return (
        <div className="talon">
            <h2>Talon:</h2>
            <div className="cards2">
                {talonCards.map((card) => (
                    <div key={card.id} className="card2">
                        <img src={card.image} alt={`${card.value} ${card.suit}`} />
                        <p>{card.value} {card.suit}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Talon;
