interface DiceNetIconProps {
  className?: string;
  faces: Array<{ id: number; x: number; y: number }>;
}

export const DiceNetIcon = ({ className = "", faces }: DiceNetIconProps) => {
  // 最大のx座標とy座標を計算
  const maxX = Math.max(...faces.map((face) => face.x)) + 100;

  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width={maxX}
      height="300"
      viewBox={`0 0 ${maxX} 300`}
    >
      {faces.map(({ id, x, y }) => (
        <rect
          key={id}
          x={x}
          y={y}
          width="100"
          height="100"
          fill="none"
          strokeWidth="10"
        />
      ))}
    </svg>
  );
};
