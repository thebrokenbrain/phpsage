<?php

declare(strict_types=1);

// This function intentionally keeps a basic undefined variable issue for smoke validation.
function brokenExample(int $value): int
{
    return $undefinedVariable + $value;
}

// This helper intentionally mixes incompatible types for static analysis coverage.
function formatMoney(int $cents): string
{
    return $cents / 100;
}
