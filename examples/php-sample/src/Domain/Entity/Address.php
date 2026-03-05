<?php

declare(strict_types=1);

namespace Example\Domain\Entity;

// This value object models address data used by user entities.
final class Address
{
    public function __construct(
        private string $street,
        private string $city,
        private string $postalCode
    ) {
    }

    public function getStreet(): string
    {
        return $this->street;
    }

    public function getCity(): string
    {
        return $this->city;
    }

    public function getPostalCode(): string
    {
        return $this->postalCode;
    }
}
