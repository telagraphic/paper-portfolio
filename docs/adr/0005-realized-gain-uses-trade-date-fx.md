# Realized gain uses the FX closes on the trade dates

Realized gain is a reporting-currency amount that stays fixed after the sell. Proceeds convert at the FX close on the sell date. The cost converts at the FX closes on the buys being closed. A later move in the trading currency does not rewrite it.

Converting the price gain at today's FX was the alternative. It keeps one rate in the code and makes a yen gain look like a dollar gain whenever the yen has moved since the trades. Each buy stores the US dollars it spent so a later sell can subtract that cost. That stored cost is the part that is annoying to redefine later.
