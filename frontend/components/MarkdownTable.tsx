import React from "react";

interface TableProps {
  children: React.ReactNode;
}

interface TableRowProps {
  children: React.ReactNode;
  isHeader?: boolean;
}

interface TableCellProps {
  children: React.ReactNode;
  isHeader?: boolean;
}

export const Table: React.FC<TableProps> = ({ children }) => (
  <div className="my-4 overflow-x-auto rounded-lg border border-gray-200">
    <table className="w-full border-collapse bg-white">{children}</table>
  </div>
);

export const TableHead: React.FC<TableProps> = ({ children }) => (
  <thead className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-gray-300">
    {children}
  </thead>
);

export const TableBody: React.FC<TableProps> = ({ children }) => (
  <tbody className="divide-y divide-gray-200">{children}</tbody>
);

export const TableRow: React.FC<TableRowProps> = ({ children, isHeader = false }) => (
  <tr className={isHeader ? "" : "hover:bg-gray-50 transition-colors"}>
    {children}
  </tr>
);

export const TableCell: React.FC<TableCellProps> = ({ children, isHeader = false }) => {
  if (isHeader) {
    return (
      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 border-r last:border-r-0">
        {children}
      </th>
    );
  }
  return (
    <td className="px-4 py-3 text-sm text-gray-700 border-r last:border-r-0 break-words">
      {children}
    </td>
  );
};
