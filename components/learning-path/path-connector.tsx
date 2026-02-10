interface PathConnectorProps {
  color?: string;
  completed?: boolean;
}

export function PathConnector({ color = "#E5E5E5", completed = false }: PathConnectorProps) {
  return (
    <div className="flex justify-center">
      <div
        className="h-6 w-1 rounded-full"
        style={{ backgroundColor: completed ? color : "#E5E5E5" }}
      />
    </div>
  );
}
