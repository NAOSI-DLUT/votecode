export default function useTimer() {
  return useState("timer", () => 0);
}
