import { StyleProp, TextInput, TextStyle } from "react-native";
import { digitsOnly, formatThousands } from "../lib/money";
import { colors } from "../theme";

/** Campo de monto con separador de miles mientras se escribe. `value` son solo dígitos. */
export function MoneyInput({
  value,
  onChange,
  style,
}: {
  value: string;
  onChange: (digits: string) => void;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <TextInput
      style={style}
      keyboardType="numeric"
      value={value ? `$ ${formatThousands(value)}` : ""}
      onChangeText={(t) => onChange(digitsOnly(t))}
      placeholder="$ 0"
      placeholderTextColor={colors.inkSoft}
    />
  );
}
