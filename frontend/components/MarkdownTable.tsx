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
  <div className="my-4 overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
    <table className="w-full min-w-[500px] border-collapse bg-white text-sm">{children}</table>
  </div>
);

export const TableHead: React.FC<TableProps> = ({ children }) => (
  <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
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
      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 border-r border-gray-200 last:border-r-0 bg-blue-50/50">
        {children}
      </th>
    );
  }
  return (
    <td className="px-3 py-2.5 text-xs text-gray-700 border-r border-gray-100 last:border-r-0 break-words align-top">
      {children}
    </td>
  );
};
