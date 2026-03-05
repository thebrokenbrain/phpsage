<?php

declare(strict_types=1);

function add(int $left, int $right): int
{
    return $left + $right;
}

$result = add(2, 3);
if ($result !== 5) {
    throw new RuntimeException('Unexpected result');
}
