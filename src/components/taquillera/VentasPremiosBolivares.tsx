export const VentasPremiosBolivares = ({ form, lotteryOptions, isApproved = false }: VentasPremiosBolivaresProps) => {
  const systems = form.watch("systems");
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const newInputValues: Record<string, string> = {};
    systems.forEach((system) => {
      const id = system.lottery_system_id;
      const salesKey = `${id}-sales_bs`;
      const prizesKey = `${id}-prizes_bs`;

      newInputValues[salesKey] =
        (system.sales_bs || 0) > 0
          ? (system.sales_bs as number).toLocaleString("es-VE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "";

      newInputValues[prizesKey] =
        (system.prizes_bs || 0) > 0
          ? (system.prizes_bs as number).toLocaleString("es-VE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "";
    });
    setInputValues(newInputValues);
  }, [systems]);

  const parseInputValue = (value: string): number => {
    if (!value || value.trim() === "") return 0;
    const cleanValue = value.replace(/[^\d.,]/g, "");
    const normalizedValue = cleanValue.replace(",", ".");
    const num = parseFloat(normalizedValue);
    return isNaN(num) ? 0 : num;
  };

  const handleInputChange = (systemId: string, index: number, field: "sales_bs" | "prizes_bs", value: string) => {
    const key = `${systemId}-${field}`;
    setInputValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleInputBlur = (systemId: string, index: number, field: "sales_bs" | "prizes_bs") => {
    const key = `${systemId}-${field}`;
    const value = inputValues[key] || "";
    const numValue = parseInputValue(value);

    form.setValue(`systems.${index}.${field}`, numValue, { shouldDirty: true, shouldValidate: false });

    const formattedValue =
      numValue > 0
        ? numValue.toLocaleString("es-VE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "";

    setInputValues((prev) => ({ ...prev, [key]: formattedValue }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas y Premios en Bolívares</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="grid grid-cols-4 gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
            <div>Sistema</div>
            <div className="text-center">Ventas Bs</div>
            <div className="text-center">Premios Bs</div>
            <div className="text-center">Cuadre Bs</div>
          </div>

          {systems.map((system) => {
            const systemCuadre = (system.sales_bs || 0) - (system.prizes_bs || 0);
            const index = systems.findIndex((s) => s.lottery_system_id === system.lottery_system_id);

            return (
              <div key={system.lottery_system_id} className="grid grid-cols-4 gap-2 items-center">
                <div className="font-medium text-sm">{system.lottery_system_name}</div>

                <Input
                  type="text"
                  placeholder="0,00"
                  value={inputValues[`${system.lottery_system_id}-sales_bs`] || ""}
                  onChange={(e) => handleInputChange(system.lottery_system_id, index, "sales_bs", e.target.value)}
                  onBlur={() => handleInputBlur(system.lottery_system_id, index, "sales_bs")}
                  className="text-center"
                  disabled={isApproved}
                  readOnly={isApproved}
                />

                <Input
                  type="text"
                  placeholder="0,00"
                  value={inputValues[`${system.lottery_system_id}-prizes_bs`] || ""}
                  onChange={(e) => handleInputChange(system.lottery_system_id, index, "prizes_bs", e.target.value)}
                  onBlur={() => handleInputBlur(system.lottery_system_id, index, "prizes_bs")}
                  className="text-center"
                  disabled={isApproved}
                  readOnly={isApproved}
                />

                <div className={`text-center font-medium ${systemCuadre >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(systemCuadre, "VES")}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
