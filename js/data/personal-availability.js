(() => {
  "use strict";
  const streaming = item => Boolean(window.PlatformAvailabilityMatch?.matches(item));
  const physical = item => item?.ownedPhysical === true;
  const matches = item => streaming(item) || physical(item);
  const reasons = item => Object.freeze({ streaming: streaming(item), physical: physical(item) });
  window.PersonalAvailability = Object.freeze({ matches, streaming, physical, reasons });
})();
