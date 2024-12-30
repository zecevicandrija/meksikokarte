import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Button, TextField, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import '../Styles/DodajKorisnika.css'
const DodajKorisnika = () => {
    const [ime, setIme] = useState('');
    const [prezime, setPrezime] = useState('');
    const [email, setEmail] = useState('');
    const [sifra, setSifra] = useState('');
    const [uloga, setUloga] = useState('');
    const navigate = useNavigate();

    const handleDodajKorisnika = async (e) => {
        e.preventDefault();
        try {
            const noviKorisnik = { ime, prezime, email, sifra, uloga };
            await axios.post('http://localhost:5000/api/korisnici', noviKorisnik);
            navigate('/korisnici');
        } catch (error) {
            console.error('Error adding user:', error);
        }
    };

    return (
        <div className="dodajkorisnikacontainer">
            <h2 className="dodajkorisnikacontainer-title">Dodaj Korisnika</h2>
            <form onSubmit={handleDodajKorisnika} className="dodajkorisnikacontainer-form">
                <TextField
                    label="Ime"
                    value={ime}
                    onChange={(e) => setIme(e.target.value)}
                    fullWidth
                    margin="normal"
                    className="dodajkorisnikacontainer-input"
                />
                <TextField
                    label="Prezime"
                    value={prezime}
                    onChange={(e) => setPrezime(e.target.value)}
                    fullWidth
                    margin="normal"
                    className="dodajkorisnikacontainer-input"
                />
                <TextField
                    type="email"
                    label="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    fullWidth
                    margin="normal"
                    className="dodajkorisnikacontainer-input"
                />
                <TextField
                    type="password"
                    label="Å ifra"
                    value={sifra}
                    onChange={(e) => setSifra(e.target.value)}
                    fullWidth
                    margin="normal"
                    className="dodajkorisnikacontainer-input"
                />
                <FormControl fullWidth margin="normal" className="dodajkorisnikacontainer-input">
                    <InputLabel id="select-uloga-label">Uloga</InputLabel>
                    <Select
                        labelId="select-uloga-label"
                        value={uloga}
                        onChange={(e) => setUloga(e.target.value)}
                    >
                        <MenuItem value="admin">Admin</MenuItem>
                        <MenuItem value="nabavka">Nabavka</MenuItem>
                        <MenuItem value="komercijala">Komercijala</MenuItem>
                        <MenuItem value="radnik">Radnik</MenuItem>
                        <MenuItem value="finansije">Finansije</MenuItem>
                    </Select>
                </FormControl>
                <Button type="submit" variant="contained" color="primary" className="dodajkorisnikacontainer-button">
                    Dodaj Korisnika
                </Button>
            </form>
        </div>
    );
};

export default DodajKorisnika;