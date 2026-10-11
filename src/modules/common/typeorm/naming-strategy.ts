/* eslint-disable class-methods-use-this,max-len,@typescript-eslint/no-unused-vars */
import { DefaultNamingStrategy, NamingStrategyInterface, Table } from 'typeorm';

function generate(tableOrName: Table | string, columnNames: string[], suffix = '') {
  const tableName = typeof tableOrName === 'string' ? tableOrName : tableOrName.name;

  const name = columnNames.reduce((n, column) => `${n}_${column}`, tableName);

  return name + (suffix ? `_${suffix}` : '');
}

export class CustomNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  foreignKeyName(
    tableOrName: Table | string,
    columnNames: string[],
    referencedTablePath?: string,
    referencedColumnNames?: string[],
  ): string {
    return generate(tableOrName, columnNames, 'foreign');
  }
}
