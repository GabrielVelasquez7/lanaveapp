import { UseFormReturn } from "react-hook-form";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { VentasPremiosForm } from "./VentasPremiosManager";

interface LotterySystem {
  id: string;
  name: string;
  code: string;
}

interface VentasPremiosDolaresProps {
  form: UseFormReturn<VentasPremiosForm>;
  lotteryOptions: LotterySystem[];
  isApproved?: boolean;
}

export const VentasPremiosDolares = ({ form, lotteryOptions, isApproved = false }: VentasPremiosDolaresProps) => {
  const systems = form.watch("systems");
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const isInitialMount = useRef(true);
  const previousSystemsRef = useRef<string>('');

  const parseInputValue = (value: string): number => {
    if (!value || value.trim() === "") return 0;
    
    // Remover todos los caracteres que no sean dígitos, puntos o comas
    const cleanValue = value.replace(/[^\d.,]/g, "");
    
    // Para formato en-US: coma es separador de miles, punto es separador decimal
    // Si hay punto, es el separador decimal
    if (cleanValue.includes(".")) {
      // Remover todas las comas (separadores de miles) y mantener el punto
      const normalizedValue = cleanValue.replace(/,/g, "");
      const num = parseFloat(normalizedValue);
      return isNaN(num) ? 0 : num;
    }
    
    // Si hay coma pero no punto, determinar si es separador de miles o decimal
    if (cleanValue.includes(",")) {
      // Si la coma está en las últimas 3 posiciones (ej: "1223,50"), es decimal
      // Si no, es separador de miles
      const lastCommaIndex = cleanValue.lastIndexOf(",");
      const afterComma = cleanValue.substring(lastCommaIndex + 1);
      
      // Si después de la última coma hay 1 o 2 dígitos, es decimal
      if (afterComma.length <= 2 && afterComma.length > 0) {
        // Es decimal: remover otras comas y reemplazar la última por punto
        const beforeLastComma = cleanValue.substring(0, lastCommaIndex).replace(/,/g, "");
        const normalizedValue = `${beforeLastComma}.${afterComma}`;
        const num = parseFloat(normalizedValue);
        return isNaN(num) ? 0 : num;
      } else {
        // Es separador de miles: remover todas las comas
        const normalizedValue = cleanValue.replace(/,/g, "");
        const num = parseFloat(normalizedValue);
        return isNaN(num) ? 0 : num;
      }
    }
    
    // Si no hay puntos ni comas, es un número entero
    const num = parseFloat(cleanValue);
    return isNaN(num) ? 0 : num;
  };

  // Sincronizar solo cuando cambian los sistemas o se inicializa, preservando valores en edición
  useEffect(() => {
    const systemsKey = systems.map(s => `${s.lottery_system_id}-${s.sales_usd}-${s.prizes_usd}`).join(',');
    
    // Si es el montaje inicial o los sistemas realmente cambiaron (no solo por re-render)
    if (isInitialMount.current || previousSystemsRef.current !== systemsKey) {
      setInputValues(prev => {
        const newInputValues: Record<string, string> = {};
        
        systems.forEach((system) => {
          const id = system.lottery_system_id;
          const salesKey = `${id}-sales_usd`;
          const prizesKey = `${id}-prizes_usd`;

          const formattedSales = (system.sales_usd || 0) > 0
            ? (system.sales_usd as number).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "";

          const formattedPrizes = (system.prizes_usd || 0) > 0
            ? (system.prizes_usd as number).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "";

          // Preservar valores existentes si están siendo editados
          const currentSales = prev[salesKey];
          const currentPrizes = prev[prizesKey];
          
          // Si hay un valor actual y es diferente al formateado, preservarlo (está siendo editado)
          if (currentSales && parseInputValue(currentSales) !== (system.sales_usd || 0)) {
            newInputValues[salesKey] = currentSales;
          } else {
            newInputValues[salesKey] = formattedSales;
          }
          
          if (currentPrizes && parseInputValue(currentPrizes) !== (system.prizes_usd || 0)) {
            newInputValues[prizesKey] = currentPrizes;
          } else {
            newInputValues[prizesKey] = formattedPrizes;
          }
        });
        
        return newInputValues;
      });
      
      previousSystemsRef.current = systemsKey;
      isInitialMount.current = false;
    }
  }, [systems]);

  const handleInputChange = (systemId: string, index: number, field: "sales_usd" | "prizes_usd", value: string) => {
    const key = `${systemId}-${field}`;
    setInputValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleInputBlur = (systemId: string, index: number, field: "sales_usd" | "prizes_usd") => {
    const key = `${systemId}-${field}`;
    const value = inputValues[key] || "";
    const numValue = parseInputValue(value);

    form.setValue(`systems.${index}.${field}`, numValue, { shouldDirty: true, shouldValidate: false });

    const formattedValue =
      numValue > 0
        ? numValue.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "";

    setInputValues((prev) => ({ ...prev, [key]: formattedValue }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas y Premios en Dólares</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="grid grid-cols-4 gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
            <div>Sistema</div>
            <div className="text-center">Ventas USD</div>
            <div className="text-center">Premios USD</div>
            <div className="text-center">Cuadre USD</div>
          </div>

          {systems.map((system) => {
            const systemCuadre = (system.sales_usd || 0) - (system.prizes_usd || 0);
            const index = systems.findIndex((s) => s.lottery_system_id === system.lottery_system_id);

            return (
              <div key={system.lottery_system_id} className="grid grid-cols-4 gap-2 items-center">
                <div className="font-medium text-sm">{system.lottery_system_name}</div>

                <Input
                  type="text"
                  placeholder="0.00"
                  value={inputValues[`${system.lottery_system_id}-sales_usd`] || ""}
                  onChange={(e) => handleInputChange(system.lottery_system_id, index, "sales_usd", e.target.value)}
                  onBlur={() => handleInputBlur(system.lottery_system_id, index, "sales_usd")}
                  className="text-center"
                  disabled={isApproved}
                  readOnly={isApproved}
                />

                <Input
                  type="text"
                  placeholder="0.00"
                  value={inputValues[`${system.lottery_system_id}-prizes_usd`] || ""}
                  onChange={(e) => handleInputChange(system.lottery_system_id, index, "prizes_usd", e.target.value)}
                  onBlur={() => handleInputBlur(system.lottery_system_id, index, "prizes_usd")}
                  className="text-center"
                  disabled={isApproved}
                  readOnly={isApproved}
                />

                <div className={`text-center font-medium ${systemCuadre >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(systemCuadre, "USD")}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
