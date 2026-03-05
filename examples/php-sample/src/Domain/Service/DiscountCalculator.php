<?php

declare(strict_types=1);

namespace Example\Domain\Service;

// This service intentionally returns incompatible types under strict return declarations.
final class DiscountCalculator
{
    public function calculatePercent(string $tier): int
    {
        return match ($tier) {
            'gold' => 12.5,
            'silver' => 7,
            default => '0',
        };
    }
}
