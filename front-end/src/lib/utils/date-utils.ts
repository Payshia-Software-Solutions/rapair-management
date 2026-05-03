/**
 * Date Utility Wrapper
 */
export class DateTime {
  private date: Date;

  constructor(dateString?: string | Date) {
    this.date = dateString ? new Date(dateString) : new Date();
  }

  format(formatStr: string): string {
    const d = this.date;
    if (isNaN(d.getTime())) return "Invalid Date";

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return formatStr
      .replace('yyyy', String(year))
      .replace('MM', month)
      .replace('dd', day);
  }

  modify(modifier: string) {
    const match = modifier.match(/([+-]\d+)\s+(\w+)/);
    if (!match) return;

    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    if (unit.startsWith('day')) {
      this.date.setDate(this.date.getDate() + amount);
    } else if (unit.startsWith('week')) {
      this.date.setDate(this.date.getDate() + amount * 7);
    } else if (unit.startsWith('month')) {
      this.date.setMonth(this.date.getMonth() + amount);
    } else if (unit.startsWith('year')) {
      this.date.setFullYear(this.date.getFullYear() + amount);
    }
    
    // Handle days subtraction for "1 month - 1 day" type modifiers
    if (modifier.includes(' -1 day')) {
        this.date.setDate(this.date.getDate() - 1);
    }
  }
}
