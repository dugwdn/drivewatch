import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#F4F7FA',
  card: '#FFFFFF',
  text: '#10212E',
  muted: '#5B6B78',
  line: '#D9E2EA',
  brand: '#1F6FEB',
  danger: '#C62828',
  warn: '#B26A00',
  ok: '#2E7D32',
};

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: 16, gap: 12 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, gap: 6, borderWidth: 1, borderColor: colors.line },
  h1: { fontSize: 24, fontWeight: '700', color: colors.text },
  h2: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { fontSize: 16, color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 12,
    fontSize: 17,
    color: colors.text,
  },
  button: { backgroundColor: colors.brand, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  buttonQuiet: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  buttonQuietText: { color: colors.brand, fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  error: { color: colors.danger, fontSize: 15 },
});
