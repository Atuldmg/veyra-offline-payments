package com.demo.upimesh.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class DashboardController {

    @GetMapping("/")
    public String home(HttpServletRequest request) {
        String host = request.getServerName();
        return "redirect:http://" + host + ":8000/";
    }
}
