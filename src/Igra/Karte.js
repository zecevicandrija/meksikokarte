export const karte = [
    // Pik (♠)
    { id: 1, suit: '♠', value: '7', image: '/Slike/7_spades.png' },
    { id: 2, suit: '♠', value: '8', image: '/Slike/8_spades.png' },
    { id: 3, suit: '♠', value: '9', image: '/Slike/9_spades.png' },
    { id: 4, suit: '♠', value: '10', image: '/Slike/10_spades.png' },
    { id: 5, suit: '♠', value: 'J', image: '/Slike/J_spades.png' },
    { id: 6, suit: '♠', value: 'Q', image: '/Slike/Q_spades.png' },
    { id: 7, suit: '♠', value: 'K', image: '/Slike/K_spades.png' },
    { id: 8, suit: '♠', value: 'A', image: '/Slike/A_spades.png' },

    // Herc (♥)
    { id: 9, suit: '♥', value: '7', image: '/Slike/7_hearts.png' },
    { id: 10, suit: '♥', value: '8', image: '/Slike/8_hearts.png' },
    { id: 11, suit: '♥', value: '9', image: '/Slike/9_hearts.png' },
    { id: 12, suit: '♥', value: '10', image: '/Slike/10_hearts.png' },
    { id: 13, suit: '♥', value: 'J', image: '/Slike/J_hearts.png' },
    { id: 14, suit: '♥', value: 'Q', image: '/Slike/Q_hearts.png' },
    { id: 15, suit: '♥', value: 'K', image: '/Slike/K_hearts.png' },
    { id: 16, suit: '♥', value: 'A', image: '/Slike/A_hearts.png' },

    // Karo (♦)
    { id: 17, suit: '♦', value: '7', image: '/Slike/7_diamonds.png' },
    { id: 18, suit: '♦', value: '8', image: '/Slike/8_diamonds.png' },
    { id: 19, suit: '♦', value: '9', image: '/Slike/9_diamonds.png' },
    { id: 20, suit: '♦', value: '10', image: '/Slike/10_diamonds.png' },
    { id: 21, suit: '♦', value: 'J', image: '/Slike/J_diamonds.png' },
    { id: 22, suit: '♦', value: 'Q', image: '/Slike/Q_diamonds.png' },
    { id: 23, suit: '♦', value: 'K', image: '/Slike/K_diamonds.png' },
    { id: 24, suit: '♦', value: 'A', image: '/Slike/A_diamonds.png' },

    // Detelina (♣)
    { id: 25, suit: '♣', value: '7', image: '/Slike/7_clubs.png' },
    { id: 26, suit: '♣', value: '8', image: '/Slike/8_clubs.png' },
    { id: 27, suit: '♣', value: '9', image: '/Slike/9_clubs.png' },
    { id: 28, suit: '♣', value: '10', image: '/Slike/10_clubs.png' },
    { id: 29, suit: '♣', value: 'J', image: '/Slike/J_clubs.png' },
    { id: 30, suit: '♣', value: 'Q', image: '/Slike/Q_clubs.png' },
    { id: 31, suit: '♣', value: 'K', image: '/Slike/K_clubs.png' },
    { id: 32, suit: '♣', value: 'A', image: '/Slike/A_clubs.png' },
];

// Funkcija za generisanje kompletnog špila od 32 karte
export const generateDeck = () => {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];

    suits.forEach((suit) => {
        values.forEach((value, index) => {
            deck.push({
                id: deck.length + 1,
                suit,
                value,
                image: `/Slike/${value}_${  
                    suit === '♠' ? 'spades' :
                    suit === '♥' ? 'hearts' :
                    suit === '♦' ? 'diamonds' :
                    suit === '♣' ? 'clubs' : ''
                }.png`,
                power: index + 1, // Jačina karte (7 najslabija, A najjači)
            });
        });
    });

    return deck;
};
