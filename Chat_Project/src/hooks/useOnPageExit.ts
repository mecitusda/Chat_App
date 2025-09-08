import { useEffect } from "react";

const useOnPageExit = (callback: () => void) => {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      callback();
      // Aşağıdaki satır sadece uyarı mesajı gösterilmek istenirse
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [callback]);
};

export default useOnPageExit;