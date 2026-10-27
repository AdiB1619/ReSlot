package com.reslot.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class ClockConfig {

    public static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Kolkata");

    @Bean
    public Clock clock() {
        return Clock.system(BUSINESS_ZONE);
    }
}
