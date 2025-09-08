import React from "react";

const Footer = () => {
  return (
    <footer id="footer__inner">
      <div className="footer-content container">
        <ul className="footer__links">
          <li>
            <a href="#">Privacy Policy</a>
          </li>
          <li>
            <a href="#">Terms of Service</a>
          </li>
          <li>
            <a href="#">Contact</a>
          </li>
          <li>
            <a href="#">Blog</a>
          </li>
        </ul>
        <ul className="footer__socials">
          <li>
            <a href="#" aria-label="Facebook">
              <i className="fab fa-facebook-f"></i>
            </a>
          </li>
          <li>
            <a href="#" aria-label="Twitter">
              <i className="fab fa-twitter"></i>
            </a>
          </li>
          <li>
            <a href="#" aria-label="Instagram">
              <i className="fab fa-instagram"></i>
            </a>
          </li>
        </ul>
        <p className="footer__text">
          &copy; {new Date().getFullYear()} Chat App. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
