import { useEffect, useRef, useState } from "react";

export default function useScrollAnimation(threshold = 0.2) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;

    let observer = null;

    // Gecikmeli başlat (layout tamamlandıktan sonra)
    const timeout = setTimeout(() => {
      observer = new IntersectionObserver(
        ([entry], obs) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            obs.unobserve(entry.target);
          }
        },
        { threshold }
      );

      observer.observe(target);
    }, 100); // 100ms gecikme (gerekirse artır)

    return () => {
      clearTimeout(timeout);
      if (observer && target) observer.unobserve(target);
    };
  }, [threshold]);

  return [ref, isVisible];
}
