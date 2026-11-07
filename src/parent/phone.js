// Compare phone numbers on their national part so "+250 788 123 456", "250788123456"
// and "0788123456" are treated as the same number.
export const normalizePhone = (value) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('250')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
};
