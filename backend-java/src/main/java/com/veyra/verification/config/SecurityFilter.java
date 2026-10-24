package com.veyra.verification.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Ensures browser or unauthorized clients cannot call internal cryptographic verification
 * or mesh simulator endpoints directly. Only the PHP backend application holding the
 * internal key can invoke protected endpoints.
 */
@Component
public class SecurityFilter implements Filter {

    @Value("${veyra.security.internal-api-key}")
    private String expectedApiKey;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;

        String path = req.getRequestURI();

        // Allow public health and public key endpoint
        if (path.startsWith("/api/v1/health") || path.startsWith("/api/v1/crypto/public-key")) {
            chain.doFilter(request, response);
            return;
        }

        // Allow pre-flight CORS if needed
        if ("OPTIONS".equalsIgnoreCase(req.getMethod())) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Veyra-Internal-Key, X-Bridge-Node-Id, X-Hop-Count");
            res.setStatus(HttpServletResponse.SC_OK);
            return;
        }

        String providedKey = req.getHeader("X-Veyra-Internal-Key");
        if (providedKey == null || !providedKey.equals(expectedApiKey)) {
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.setContentType("application/json");
            res.getWriter().write("{\"status\":\"ERROR\",\"error\":\"Unauthorized: Invalid or missing X-Veyra-Internal-Key\"}");
            return;
        }

        chain.doFilter(request, response);
    }
}
