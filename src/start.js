// Runs before the app: the theme and the text direction are right from the first paint (no flash of the wrong theme,
// no jump from left-to-right). The app keeps them up to date after this.
(function () {
    var root = document.documentElement;
    function read(key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch {
            return null;
        }
    }
    if (read("gridlingo.theme") === "dark") root.classList.add("dark");
    var lang = read("gridlingo.lang");
    if (typeof lang === "string" && /^[a-z]{2}$/.test(lang)) {
        root.lang = lang;
        root.dir = lang === "ar" || lang === "fa" ? "rtl" : "ltr";
    }
})();
