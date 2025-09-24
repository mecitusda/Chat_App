// utils/countryCodes.js

export async function fetchCountryDialCodes() {
  try {
    const resp = await fetch(
      "https://gist.githubusercontent.com/anubhavshrimal/75f6183458db8c453306f93521e93d37/raw/75f6183458db8c453306f93521e93d37/CountryCodes.json"
    );
    if (!resp.ok) throw new Error("Country codes fetch error");
    const data = await resp.json();
    // data örnek: [{ name: "Afghanistan", dial_code: "+93", code: "AF" }, ...]
    return data;
  } catch (err) {
    //console.error("fetchCountryDialCodes error:", err);
    return [
      // fallback liste
      { name: "Türkiye", dial_code: "+90", code: "TR" },
      { name: "United States", dial_code: "+1", code: "US" },
      { name: "Germany", dial_code: "+49", code: "DE" },
    ];
  }
}
