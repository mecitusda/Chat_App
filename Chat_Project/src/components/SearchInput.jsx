import React, { forwardRef, useMemo } from "react";
import ReactDOM from "react-dom";
import { FaChevronUp, FaChevronDown } from "react-icons/fa";
import { MdClose } from "react-icons/md";

const SearchInput = forwardRef(
  (
    {
      isSearching,
      searchQuery,
      onChange,
      onSearchNext,
      onSearchPrev,
      handleIconClick,
      searchCount,
      searchIndex,
    },
    inputRef
  ) => {
    if (typeof document === "undefined") return null;
    console.log("render");
    // Portal hedefini sabitle
    const portalTarget = useMemo(() => {
      let el = document.getElementById("search-portal-root");
      if (!el) {
        el = document.createElement("div");
        el.id = "search-portal-root";
        document.body.appendChild(el);
      }
      return el;
    }, []);

    return ReactDOM.createPortal(
      <div
        className={`chat-header__search ${isSearching ? "active" : "closed"}`}
      >
        <input
          type="text"
          ref={inputRef}
          className={`search-input ${isSearching ? "visible" : ""}`}
          value={searchQuery ?? ""}
          onChange={onChange}
          placeholder="Mesajlarda ara..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && searchCount > 0) {
              onSearchNext();
            }
          }}
        />
        <div className="divider"></div>
        <div className="chat-header__search-nav">
          <button
            className="up"
            onClick={onSearchPrev}
            disabled={searchCount === 0}
          >
            <FaChevronUp />
          </button>
          <button
            className="down"
            onClick={onSearchNext}
            disabled={searchCount === 0}
          >
            <FaChevronDown />
          </button>
          <span>
            {searchCount > 0 ? `${searchIndex + 1} / ${searchCount}` : "0 / 0"}
          </span>
          <button
            onClick={handleIconClick}
            aria-label="Kapat"
            className={`search-toggle ${isSearching ? "expanded" : ""}`}
          >
            <MdClose color="#fff" />
          </button>
        </div>
      </div>,
      portalTarget // 👈 Sabit hedef
    );
  }
);

export default React.memo(SearchInput, (prev, next) => {
  return (
    prev.isSearching === next.isSearching &&
    prev.searchQuery === next.searchQuery &&
    prev.searchCount === next.searchCount &&
    prev.searchIndex === next.searchIndex
  );
});
