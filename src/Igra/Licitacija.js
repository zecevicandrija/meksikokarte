import React, { useState } from 'react';
import '../Styles/Licitacija.css';

const Licitacija = ({ setTalonVisible, setSelectedBid, hideLicitacija }) => {
    const [selectedOption, setSelectedOption] = useState(null); // Odabrana licitacija

    const options = ['Dalje', '5', '6', '7', '8', '9', '10', 'Meksiko'];

    const handleOptionClick = (option) => {
        setSelectedOption(option); // Postavlja odabranu opciju u lokalni state
        setSelectedBid(option); // Postavlja izabranu licitaciju u roditeljski state
        setTalonVisible(true); // Otkriva talon
        hideLicitacija(); // Sakriva komponentu licitacije
    };

    return (
        <div className="licitacija">
            <h2>Licitacija:</h2>
            <div className="options">
                {options.map((option, index) => (
                    <button
                        key={index}
                        className={`option ${selectedOption === option ? 'selected' : ''}`}
                        onClick={() => handleOptionClick(option)}
                        disabled={!!selectedOption} // Onemogućava biranje više od jedne opcije
                    >
                        {option}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default Licitacija;
