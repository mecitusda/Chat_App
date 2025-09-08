import React from "react";

const Header = () => {
  return (
    /* __inner kısmı inputla değişicek. */
    <header id="header__inner">
      <div className="container">
        <nav className="main-nav">
          <a href="/">
            <img
              src="../../public/images/logo.png"
              alt="icon"
              className="main-nav__logo"
            />
          </a>
          <ul className="main-nav__items">
            <li>
              <a href="#">Home</a>
            </li>
            <li>
              <a href="#">About</a>
            </li>
            <li>
              <a href="#">Contact</a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
