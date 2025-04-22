import React, { useState } from 'react';
import '../Styles/Kontakt.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faPhone, faClock } from '@fortawesome/free-solid-svg-icons';
import logo from '../Slike/meksikologo.png';
import emailjs from 'emailjs-com';

const Kontakt = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    message: ''
  });

  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    if (Object.keys(newErrors).length === 0) {
      const templateParams = {
        from_name: `${formData.firstName} ${formData.lastName}`,
        from_email: formData.email,
        message: formData.message
      };
  
      emailjs
        .send(
          'service_0g3n7pi',   // Vaš EmailJS service ID
          'template_k0bwaqs',  // Vaš EmailJS template ID
          templateParams,
          'n91F4xt4aCim64B6N'       // Vaš EmailJS korisnički/public key
        )
        .then(
          (result) => {
            console.log('Email poslat:', result.text);
            setSuccess('Poruka je uspešno poslata!');
            setFormData({ firstName: '', lastName: '', email: '', message: '', newsletter: false });
          },
          (error) => {
            console.error('Greška pri slanju emaila:', error.text);
          }
        );
    } else {
      setErrors(newErrors);
    }
  };
  

  const validateForm = () => {
    const errors = {};
    if (!formData.firstName.trim()) errors.firstName = 'Molimo popunite ovo polje';
    if (!formData.lastName.trim()) errors.lastName = 'Molimo popunite ovo polje';
    if (!/^\S+@\S+\.\S+$/.test(formData.email)) errors.email = 'Neispravan format emaila';
    if (formData.message.trim().length < 10) errors.message = 'Poruka mora imati najmanje 10 karaktera';
    return errors;
  };

  return (
    <section className="contact-section">
      <div className="contact-container">
        <div className="contact-info">
          <h2>Kontakt</h2>
          <p>
            Ukoliko imate bilo kakve kritike, savete, ponude, nedoumice ili možda pohvale za igru,
            možete me kontaktirati putem mail-a.
          </p>
          <div className="contact-details">
            <div className="contact-item">
              <FontAwesomeIcon icon={faMapMarkerAlt} />
              <span>Vrbas</span>
            </div>
            <div className="contact-item">
              <FontAwesomeIcon icon={faPhone} />
              <span>zecevic147@gmail.com</span>
            </div>
            {/* <div className="contact-item">
              <FontAwesomeIcon icon={faClock} />
              <span>24/7</span>
            </div> */}
            <div className="logokontakt">
              <img src={logo} alt="logo" className="logosrc" />
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="contact-form">
          <div className="form-group">
            <label>Ime</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              className={errors.firstName ? 'error' : ''}
            />
            {errors.firstName && <p className="error-message">{errors.firstName}</p>}
          </div>
          <div className="form-group">
            <label>Prezime</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              className={errors.lastName ? 'error' : ''}
            />
            {errors.lastName && <p className="error-message">{errors.lastName}</p>}
          </div>
          <div className="form-group">
            <label>Email Adresa</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? 'error' : ''}
            />
            {errors.email && <p className="error-message">{errors.email}</p>}
          </div>
          <div className="form-group">
            <label>Poruka</label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              className={errors.message ? 'error' : ''}
            />
            {errors.message && <p className="error-message">{errors.message}</p>}
          </div>
          <button type="submit" className="submit-btn">Pošalji</button>
          {success && <p className="success-message">{success}</p>}
        </form>
      </div>
    </section>
  );
};

export default Kontakt;
