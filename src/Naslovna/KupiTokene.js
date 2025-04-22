import React, { useState, useEffect } from 'react';
import '../Styles/KupiTokene.css';
import axios from 'axios';
import { useAuth } from '../Login/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

const KupiTokene = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tokeni, setTokeni] = useState(0);
  const [error, setError] = useState(null);
  const [paidFor, setPaidFor] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Definisani paketi za kupovinu tokena
  const packages = [
    { id: 1, tokens: 1000, price: "2.00" },
    { id: 2, tokens: 5000, price: "9.00" },
    { id: 3, tokens: 10000, price: "16.00" }
  ];
  
  const [selectedPackage, setSelectedPackage] = useState(packages[0]);

  // Funkcija za učitavanje trenutnog stanja tokena sa backend-a
  const fetchTokenCount = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/tokeni/moji?userId=${user.id}`);
      setTokeni(response.data.tokeni);
    } catch (err) {
      console.error("Greška pri učitavanju tokena:", err);
      setError("Neuspešno učitavanje tokena.");
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchTokenCount();
    }
  }, [user]);

  // Kreiranje PayPal porudžbine pozivom backend rute
  const createOrder = async (data, actions) => {
    try {
      setIsProcessing(true);
      const payload = {
        amount: selectedPackage.price,
        currency: "USD",
        description: `Kupovina tokena - ${selectedPackage.tokens} tokena`
      };
      const response = await axios.post("http://localhost:5000/api/paypal/create-order", payload, {
        headers: { "Content-Type": "application/json" }
      });
      return response.data.id;
    } catch (err) {
      console.error("Greška prilikom kreiranja porudžbine:", err);
      setError("Došlo je do greške pri kreiranju porudžbine.");
      setIsProcessing(false);
    }
  };

  // Nakon što korisnik odobri plaćanje, potvrđujemo porudžbinu i dodajemo tokene
  const onApprove = async (data, actions) => {
    try {
      const captureResponse = await axios.post("http://localhost:5000/api/paypal/capture-order", { orderID: data.orderID }, {
        headers: { "Content-Type": "application/json" }
      });
      console.log("Porudžbina potvrđena:", captureResponse.data);
      
      // Nakon uspešnog plaćanja, dodajemo tokene korisniku
      await axios.post("http://localhost:5000/api/tokeni/dodaj", {
        userId: user.id,
        kolicina: selectedPackage.tokens
      });
      
      setPaidFor(true);
      fetchTokenCount();
      setIsProcessing(false);
    } catch (err) {
      console.error("Greška prilikom potvrde porudžbine:", err);
      setError("Došlo je do greške prilikom potvrde plaćanja.");
      setIsProcessing(false);
    }
  };

  // Menjanje izabranog paketa
  const handlePackageSelect = (pkg) => {
    setSelectedPackage(pkg);
    setPaidFor(false);
    setError(null);
  };

  return (
    <div className="shop-container">
      <h2 className="shop-header">Kupovina Tokena</h2>
      <div className="token-count">Trenutno tokena: {tokeni}</div>
      
      {error && <div className="error-message">{error}</div>}
      {paidFor && <div className="success-message">Uplata uspešna! Tokeni su dodati na vaš račun.</div>}
      
      <div className="package-selection">
        <h3>Izaberite paket</h3>
        <div className="packages">
          {packages.map((pkg) => (
            <div 
              key={pkg.id} 
              className={`package-option ${selectedPackage.id === pkg.id ? 'active' : ''}`}
              onClick={() => handlePackageSelect(pkg)}
            >
              <div className="package-tokens">{pkg.tokens} tokena</div>
              <div className="package-price">${pkg.price}</div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="paypal-button-container">
        <PayPalScriptProvider options={{ "client-id": process.env.REACT_APP_PAYPAL_CLIENT_ID, currency: "USD" }}>
          <PayPalButtons 
            createOrder={createOrder}
            onApprove={onApprove}
            onError={(err) => {
              console.error("PayPal greška:", err);
              setError("Greška prilikom obrade plaćanja.");
            }}
            disabled={isProcessing}
          />
        </PayPalScriptProvider>
      </div>
      
      <button className="back-btn" onClick={() => navigate("/")}>Nazad</button>
    </div>
  );
};

export default KupiTokene;
