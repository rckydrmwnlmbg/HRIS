'use client';

import React from 'react';

interface DataTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
  wrapperClassName?: string;
}

export function DataTable({ children, className = '', wrapperClassName = '', ...props }: DataTableProps) {
  return (
    <div className={`table-wrapper ${wrapperClassName}`}>
      <table className={`data-table ${className}`} role="table" {...props}>
        {children}
      </table>
    </div>
  );
}
