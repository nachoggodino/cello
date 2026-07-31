# Curated HyperFormula Functions For Cello

This is a practical authoring reference for common Cello formulas. It is not a complete HyperFormula reference; HyperFormula supports a much larger Excel/Google Sheets-like function surface. For exact edge cases, criteria syntax, optional arguments, and version-specific behavior, fetch current HyperFormula docs with Context7.

Cello translates named column references before HyperFormula evaluates formulas, so examples can use Cello ranges such as `Amount`, `Amount[*]`, `Orders!Amount`, and `Orders!Amount[2:5]`.

## Aggregation

| Function                                    | Use                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `SUM(Value1, ...ValueN)`                    | Adds numbers or ranges. Common with `=SUM(Amount)` for totals above the current row. |
| `AVERAGE(Value1, ...ValueN)`                | Returns the arithmetic mean of numbers or ranges.                                    |
| `MIN(Value1, ...ValueN)`                    | Returns the smallest numeric value.                                                  |
| `MAX(Value1, ...ValueN)`                    | Returns the largest numeric value.                                                   |
| `MEDIAN(Value1, ...ValueN)`                 | Returns the middle value of a numeric set.                                           |
| `PRODUCT(Value1, ...ValueN)`                | Multiplies numbers together.                                                         |
| `SUMPRODUCT(Array1, Array2, ...ArrayN)`     | Multiplies matching array values and sums the products.                              |
| `SUBTOTAL(Function_num, Range1, ...RangeN)` | Computes a subtotal using a selected aggregate function number.                      |

## Counting

| Function                                              | Use                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `COUNT(Value1, ...ValueN)`                            | Counts numeric values only. Use `COUNTA` for text/non-empty cells. |
| `COUNTA(Value1, ...ValueN)`                           | Counts non-empty values, including text.                           |
| `COUNTBLANK(Range)`                                   | Counts empty cells in a range.                                     |
| `COUNTIF(Range, Criterion)`                           | Counts cells matching one condition.                               |
| `COUNTIFS(Range1, Criterion1, ...RangeN, CriterionN)` | Counts rows matching multiple conditions.                          |

## Conditional Aggregation

| Function                                                      | Use                                               |
| ------------------------------------------------------------- | ------------------------------------------------- |
| `SUMIF(Range, Criterion, SumRange)`                           | Sums values where one condition matches.          |
| `SUMIFS(SumRange, Range1, Criterion1, ...RangeN, CriterionN)` | Sums values where multiple conditions match.      |
| `AVERAGEIF(Range, Criterion, AverageRange)`                   | Averages values where one condition matches.      |
| `MAXIFS(MaxRange, Range1, Criterion1, ...RangeN, CriterionN)` | Returns the maximum value where conditions match. |
| `MINIFS(MinRange, Range1, Criterion1, ...RangeN, CriterionN)` | Returns the minimum value where conditions match. |

## Logic And Errors

| Function                                         | Use                                                      |
| ------------------------------------------------ | -------------------------------------------------------- |
| `IF(Condition, Value_if_true, Value_if_false)`   | Chooses between two values.                              |
| `IFS(Condition1, Value1, ...ConditionN, ValueN)` | Chooses the first value whose condition is true.         |
| `SWITCH(Expression, Case1, Value1, ...Default)`  | Maps one expression to matching case values.             |
| `AND(Value1, ...ValueN)`                         | Returns true when all arguments are true.                |
| `OR(Value1, ...ValueN)`                          | Returns true when any argument is true.                  |
| `NOT(Value)`                                     | Inverts a boolean value.                                 |
| `IFERROR(Value, Value_if_error)`                 | Returns a fallback when a formula evaluates to an error. |
| `IFNA(Value, Value_if_na)`                       | Returns a fallback only for `#N/A` errors.               |

## Lookup And Reference

| Function                                                                                   | Use                                                                   |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `XLOOKUP(Lookup_value, Lookup_array, Return_array, If_not_found, Match_mode, Search_mode)` | Modern lookup that returns the matching value from a return range.    |
| `VLOOKUP(Search_key, Range, Index, Is_sorted)`                                             | Looks down the first column of a range and returns a column by index. |
| `HLOOKUP(Search_key, Range, Index, Is_sorted)`                                             | Looks across the first row of a range and returns a row by index.     |
| `MATCH(Search_key, Range, Search_type)`                                                    | Returns the relative position of a matching value.                    |
| `INDEX(Reference, Row, Column)`                                                            | Returns a value from a range by row and column position.              |
| `CHOOSE(Index, Value1, ...ValueN)`                                                         | Returns one value from a list by numeric index.                       |

## Text

| Function                                                 | Use                                                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `CONCATENATE(Value1, ...ValueN)`                         | Joins text values. The `&` operator is often shorter.                                    |
| `LEFT(Text, Number)`                                     | Returns characters from the start of text.                                               |
| `RIGHT(Text, Number)`                                    | Returns characters from the end of text.                                                 |
| `MID(Text, Start, Number)`                               | Returns characters from the middle of text.                                              |
| `LEN(Text)`                                              | Returns text length.                                                                     |
| `LOWER(Text)`                                            | Converts text to lowercase.                                                              |
| `UPPER(Text)`                                            | Converts text to uppercase.                                                              |
| `TRIM(Text)`                                             | Removes extra spaces.                                                                    |
| `SUBSTITUTE(Text, Search_for, Replace_with, Occurrence)` | Replaces matching text.                                                                  |
| `REPLACE(Text, Position, Length, New_text)`              | Replaces text by position and length.                                                    |
| `FIND(Search_for, Text_to_search, Starting_at)`          | Finds text position, case-sensitive.                                                     |
| `EXACT(Text1, Text2)`                                    | Tests whether two text values are exactly equal.                                         |
| `TEXT(Number, Format)`                                   | Formats a number as text. Prefer Cello modifiers like `[2d]`/`[$]` for rendered display. |

## Date And Time

| Function                                      | Use                                                   |
| --------------------------------------------- | ----------------------------------------------------- |
| `DATE(Year, Month, Day)`                      | Builds a date value.                                  |
| `DATEVALUE(Date_text)`                        | Converts date text to a date value.                   |
| `TODAY()`                                     | Returns the current date at evaluation time.          |
| `NOW()`                                       | Returns the current date and time at evaluation time. |
| `YEAR(Date)`                                  | Extracts the year.                                    |
| `MONTH(Date)`                                 | Extracts the month number.                            |
| `DAY(Date)`                                   | Extracts the day of month.                            |
| `WEEKDAY(Date, Type)`                         | Returns day of week.                                  |
| `DAYS(End_date, Start_date)`                  | Returns days between two dates.                       |
| `DATEDIF(Start_date, End_date, Unit)`         | Returns a date difference in the requested unit.      |
| `EDATE(Start_date, Months)`                   | Shifts a date by a number of months.                  |
| `EOMONTH(Start_date, Months)`                 | Returns the last day of a shifted month.              |
| `WORKDAY(Start_date, Num_days, Holidays)`     | Returns a date after a number of working days.        |
| `NETWORKDAYS(Start_date, End_date, Holidays)` | Counts working days between two dates.                |

## Math And Rounding

| Function                    | Use                                   |
| --------------------------- | ------------------------------------- |
| `ABS(Number)`               | Returns absolute value.               |
| `ROUND(Number, Places)`     | Rounds to a number of decimal places. |
| `ROUNDUP(Number, Places)`   | Rounds away from zero.                |
| `ROUNDDOWN(Number, Places)` | Rounds toward zero.                   |
| `TRUNC(Number, Places)`     | Truncates decimal places.             |
| `INT(Number)`               | Rounds down to an integer.            |
| `MOD(Dividend, Divisor)`    | Returns remainder after division.     |
| `POWER(Base, Exponent)`     | Raises a number to a power.           |
| `SQRT(Number)`              | Returns square root.                  |
| `EXP(Number)`               | Returns e raised to a power.          |
| `LN(Number)`                | Returns natural logarithm.            |
| `PI()`                      | Returns pi.                           |

## Information

| Function           | Use                                 |
| ------------------ | ----------------------------------- |
| `ISBLANK(Value)`   | Tests whether a value is blank.     |
| `ISNUMBER(Value)`  | Tests whether a value is numeric.   |
| `ISTEXT(Value)`    | Tests whether a value is text.      |
| `ISNONTEXT(Value)` | Tests whether a value is not text.  |
| `ISLOGICAL(Value)` | Tests whether a value is boolean.   |
| `ISERROR(Value)`   | Tests whether a value is any error. |
| `ISNA(Value)`      | Tests whether a value is `#N/A`.    |
